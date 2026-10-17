import { LIMITS, buildOrder, generateOrderId, normalizePromoCode, promoProblem, publicStock, stockShortages, validateOrderRequest } from "@platform/commerce";
import type { Order, PriceLookup, PromoCode, PromoProblem, ShippingConfig } from "@platform/commerce";
import { BASE_HEADERS, MAX_BODY_BYTES, errorLabel, isRecord, json, readBodyLimited } from "./http.ts";
import { cookieValue } from "./meta.ts";
import type { BrowserSignal, PurchaseReporter } from "./meta.ts";
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
  /**
   * Sends the order's Purchase event to Meta from the server (Conversions API, see meta.ts), owner-approved on
   * 2026-10-17. Called only when the order says the visitor accepted cookies (`consent: true`). Its failure never
   * fails the order.
   */
  reportPurchase?: PurchaseReporter;
  /** Keeps background work alive after the response (Workers `ctx.waitUntil`). */
  waitUntil?: (work: Promise<unknown>) => void;
  /** Handles the admin (see admin.ts). Without it, admin paths are a plain 404. */
  admin?: (request: Request, path: string) => Promise<Response>;
  /**
   * The only hostname that serves the admin, e.g. "admin.vicuna-eg.com". The admin never shares an origin with
   * the store, so a script on a store page cannot use the owner's Access session.
   */
  adminHost?: string;
  /**
   * Per-visitor rate limits (Workers Rate Limiting). Returns false when this visitor has used up the limit for
   * `kind`. Without it (tests, local dev) nothing is limited. Orders take stock, so floods of fake orders must not
   * be able to empty the shop; promo checks are limited so codes cannot be guessed one after another.
   */
  allow?: (kind: "order" | "promo", key: string) => Promise<boolean>;
}

const ID_ATTEMPTS = 5;
/** Public stock is capped at what one order could use, so real quantities on hand are not disclosed. */
const PUBLIC_STOCK_CAP = LIMITS.maxQuantityPerItem;

/** The customer is never told that a code exists but was switched off: it is simply not valid. */
const publicProblem = (p: PromoProblem): PromoProblem => (p === "promo_inactive" ? "invalid_promo" : p);

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
    ...(order.promoCode ? { promoCode: order.promoCode } : {}),
    totals: order.totals,
  };
}

/** The visitor's browser as the order request shows it (IP, user agent, Meta cookies, the page it came from). */
function browserSignal(request: Request, origin: string | null): BrowserSignal {
  const h = request.headers;
  const cookies = h.get("Cookie");
  const referer = h.get("Referer");
  const signal: BrowserSignal = {};
  const ip = h.get("CF-Connecting-IP");
  const userAgent = h.get("User-Agent");
  const fbp = cookieValue(cookies, "_fbp");
  const fbc = cookieValue(cookies, "_fbc");
  if (ip) signal.ip = ip;
  if (userAgent) signal.userAgent = userAgent.slice(0, 500);
  if (fbp) signal.fbp = fbp;
  if (fbc) signal.fbc = fbc;
  // The page on this site the order came from; never another site's address.
  if (origin && referer?.startsWith(`${origin}/`)) signal.sourceUrl = referer.split("#")[0]!.slice(0, 500);
  else if (origin) signal.sourceUrl = `${origin}/`;
  return signal;
}

/**
 * Routes (the optional "/api" prefix is stripped, so the Worker can sit on vicuna-eg.com/api/*):
 *   GET     /health
 *   GET     /stock    tracked products' availability (capped), for the store pages and the cart
 *   GET     /promo?code=X  whether a promo code can be used, and its amount (the cart's preview)
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
    // Cloudflare sets CF-Connecting-IP to the visitor's address; it cannot be set by the visitor.
    const visitor = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const limited = async (kind: "order" | "promo") => (deps.allow ? !(await deps.allow(kind, visitor).catch(() => true)) : false);
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

    if (path === "/promo") {
      if (request.method !== "GET") return json(405, { error: "method_not_allowed" }, { Allow: "GET" });
      const headers = { ...cors, "Cache-Control": "no-store" };
      if (await limited("promo")) return json(429, { error: "too_many_requests" }, { ...headers, "Retry-After": "60" });
      const code = normalizePromoCode(url.searchParams.get("code"));
      if (!code) return json(422, { error: "invalid_promo" }, headers);
      try {
        const found = await deps.repository.getPromo(code);
        // The minimum order is checked by the cart with the returned value, and again by POST /orders.
        const problem = promoProblem(found, Number.MAX_SAFE_INTEGER, deps.now());
        if (problem || !found) return json(422, { error: publicProblem(problem ?? "invalid_promo") }, headers);
        return json(200, { code: found.code, amount: found.amount, minSubtotal: found.minSubtotal }, headers);
      } catch (error) {
        deps.reportError?.(`promo_failed:${errorLabel(error)}`);
        return json(500, { error: "server_error" }, headers);
      }
    }

    if (path !== "/orders") return json(404, { error: "not_found" });

    if (request.method === "OPTIONS") {
      return originAllowed ? new Response(null, { status: 204, headers: { ...BASE_HEADERS, ...cors } }) : json(403, { error: "forbidden_origin" });
    }
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, { Allow: "POST, OPTIONS" });

    if (!originAllowed) return json(403, { error: "forbidden_origin" });
    if (await limited("order")) return json(429, { error: "too_many_requests" }, { ...cors, "Retry-After": "60" });
    // The media type itself must be application/json (parameters such as charset are fine); a header that merely
    // contains the words, e.g. "text/plain; x=application/json", is refused.
    const mediaType = (request.headers.get("Content-Type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (mediaType !== "application/json") {
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
      // Promo code: the API decides, whatever the cart showed.
      let promo: { code: string; amount: number } | undefined;
      if (result.value.promoCode) {
        const found: PromoCode | null = await deps.repository.getPromo(result.value.promoCode);
        const subtotal = buildOrder(result.value, deps.lookup, deps.shipping, { id: "check", now: deps.now() }).totals.subtotal;
        const problem = promoProblem(found, subtotal, deps.now());
        if (problem || !found) {
          return json(422, { error: "validation_failed", errors: { promoCode: publicProblem(problem ?? "invalid_promo") } }, cors);
        }
        promo = { code: found.code, amount: found.amount };
      }
      for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
        const now = deps.now();
        const order = buildOrder(result.value, deps.lookup, deps.shipping, {
          id: generateOrderId(now, deps.randomBytes(8)),
          now,
          ...(promo ? { promo } : {}),
        });
        const stored = await deps.repository.insert(order);
        if (stored === "ok") {
          if (deps.notify) {
            const sent = deps.notify(order).catch((error: unknown) => deps.reportError?.(`notify_failed:${errorLabel(error)}`));
            if (deps.waitUntil) deps.waitUntil(sent);
          }
          // Only for a visitor who accepted cookies, like the Pixel in the browser.
          if (deps.reportPurchase && isRecord(body) && body["consent"] === true) {
            const reported = deps.reportPurchase(order, browserSignal(request, origin)).catch((error: unknown) => deps.reportError?.(`purchase_report_failed:${errorLabel(error)}`));
            if (deps.waitUntil) deps.waitUntil(reported);
          }
          return json(201, { order: publicOrder(order) }, cors);
        }
        if (stored === "promo_used_up") {
          return json(422, { error: "validation_failed", errors: { promoCode: "promo_used_up" } }, cors);
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
