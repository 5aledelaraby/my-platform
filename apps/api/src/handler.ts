import { LIMITS, buildOrder, generateOrderId, publicStock, stockShortages, validateOrderRequest } from "@platform/commerce";
import type { Order, PriceLookup, ShippingConfig } from "@platform/commerce";
import { BASE_HEADERS, MAX_BODY_BYTES, errorLabel, isRecord, json, readBodyLimited } from "./http.ts";
import type { Notifier } from "./notify.ts";
import type { OrderRepository } from "./repository.ts";

export { MAX_BODY_BYTES };

export interface HandlerDeps {
  /** Authoritative prices. The client never sends prices. */
  lookup: PriceLookup;
  shipping: ShippingConfig;
  repository: OrderRepository;
  /** Exact origins allowed to call the API from a browser, e.g. "https://vicuna-eg.com". */
  allowedOrigins: readonly string[];
  now: () => Date;
  randomBytes: (length: number) => Uint8Array;
  /** Receives only a short error label (name and failure kind), never request data (it contains personal details). */
  reportError?: (name: string) => void;
  /** Tells the owner about a stored order (e.g. Telegram). Optional; its failure never fails the order. */
  notify?: Notifier;
  /** Keeps background work alive after the response (Workers `ctx.waitUntil`). */
  waitUntil?: (work: Promise<unknown>) => void;
  /** Handles the admin (see admin.ts). Without it, admin paths are a plain 404. */
  admin?: (request: Request, path: string) => Promise<Response>;
  /**
   * The only hostname that serves the admin, e.g. "admin.vicuna-eg.com". The admin never shares an origin with
   * the store, so a script on a store page cannot use the owner's Access session.
   */
  adminHost?: string;
}

const ID_ATTEMPTS = 5;
/** Public stock is capped at what one order could use, so real quantities on hand are not disclosed. */
const PUBLIC_STOCK_CAP = LIMITS.maxQuantityPerItem;

/** What the customer gets back: no phone, no address. */
function publicOrder(order: Order) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    status: order.status,
    firstName: order.customer.name.split(" ")[0] ?? "",
    items: order.items,
    shippingMethod: order.shippingMethod,
    paymentMethod: order.paymentMethod,
    totals: order.totals,
  };
}

/**
 * Routes (the optional "/api" prefix is stripped, so the Worker can sit on vicuna-eg.com/api/*):
 *   GET     /health
 *   GET     /stock    tracked products' availability (capped), for the store pages and the cart
 *   OPTIONS /orders   CORS preflight
 *   POST    /orders   create an order
 *   (admin)           owner-only, served only on `adminHost` behind Cloudflare Access, see admin.ts
 */
export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  return async function handle(request) {
    const url = new URL(request.url);

    // Admin host: every path belongs to the admin ("/" page, "/app.js", "/api/..." JSON).
    if (deps.adminHost && url.hostname === deps.adminHost) {
      if (!deps.admin) return json(404, { error: "not_found" });
      const adminPath = url.pathname.replace(/\/+$/, "");
      return deps.admin(request, `/admin${adminPath}`);
    }

    const path = url.pathname.replace(/^\/api(?=\/|$)/, "").replace(/\/+$/, "") || "/";
    const origin = request.headers.get("Origin");
    const originAllowed = origin !== null && deps.allowedOrigins.includes(origin);
    const cors: Record<string, string> = originAllowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        }
      : { Vary: "Origin" };

    if (path === "/health") {
      if (request.method !== "GET") return json(405, { error: "method_not_allowed" });
      // Also proves the database migrations are applied (see migrations/). 503 = deploy is ahead of the schema.
      const ready = await deps.repository.schemaReady().catch(() => false);
      return ready ? json(200, { ok: true }) : json(503, { ok: false, error: "schema_outdated" });
    }

    if (path === "/stock") {
      if (request.method !== "GET") return json(405, { error: "method_not_allowed" }, { Allow: "GET" });
      try {
        const stock = await deps.repository.stock();
        return json(200, { stock: publicStock(stock, PUBLIC_STOCK_CAP) }, { ...cors, "Cache-Control": "public, max-age=30" });
      } catch (error) {
        deps.reportError?.(`stock_failed:${errorLabel(error)}`);
        return json(500, { error: "server_error" }, cors);
      }
    }

    if (path !== "/orders") return json(404, { error: "not_found" });

    if (request.method === "OPTIONS") {
      return originAllowed ? new Response(null, { status: 204, headers: { ...BASE_HEADERS, ...cors } }) : json(403, { error: "forbidden_origin" });
    }
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, { Allow: "POST, OPTIONS" });

    if (!originAllowed) return json(403, { error: "forbidden_origin" });
    if (!(request.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
      return json(415, { error: "unsupported_media_type" }, cors);
    }
    const declared = Number(request.headers.get("Content-Length") ?? "0");
    if (declared > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" }, cors);

    const raw = await readBodyLimited(request, MAX_BODY_BYTES);
    if (raw === null) return json(413, { error: "payload_too_large" }, cors);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: "invalid_json" }, cors);
    }

    // Honeypot: real visitors never see or fill this hidden field; bots do.
    if (isRecord(body) && typeof body["website"] === "string" && body["website"].trim() !== "") {
      return json(400, { error: "invalid_request" }, cors);
    }

    const result = validateOrderRequest(body, deps.lookup);
    if (!result.ok) return json(422, { error: "validation_failed", errors: result.errors }, cors);

    try {
      for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
        const now = deps.now();
        const order = buildOrder(result.value, deps.lookup, deps.shipping, {
          id: generateOrderId(now, deps.randomBytes(8)),
          now,
        });
        const stored = await deps.repository.insert(order);
        if (stored === "ok") {
          if (deps.notify) {
            const sent = deps.notify(order).catch((error: unknown) => deps.reportError?.(`notify_failed:${errorLabel(error)}`));
            if (deps.waitUntil) deps.waitUntil(sent);
          }
          return json(201, { order: publicOrder(order) }, cors);
        }
        if (stored === "out_of_stock") {
          // Nothing was stored. Tell the cart what is left so it can adjust.
          const shortages = stockShortages(result.value.items, await deps.repository.stock());
          return json(409, { error: "out_of_stock", items: shortages.map((s) => ({ id: s.id, available: s.available })) }, cors);
        }
      }
      return json(503, { error: "try_again" }, { ...cors, "Retry-After": "2" });
    } catch (error) {
      deps.reportError?.(errorLabel(error));
      return json(500, { error: "server_error" }, cors);
    }
  };
}
