import { buildOrder, generateOrderId, validateOrderRequest } from "@platform/commerce";
import type { Order, PriceLookup, ShippingConfig } from "@platform/commerce";
import type { OrderRepository } from "./repository.ts";

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
}

export const MAX_BODY_BYTES = 16 * 1024;
const ID_ATTEMPTS = 5;

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A short, PII-free label for logs: the error name plus the kind of SQLite failure when there is one
 * (e.g. "Error:CHECK"). Never the message itself, which could one day contain request data.
 */
function errorLabel(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";
  const text = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  const kind = /\b(UNIQUE|CHECK|NOT NULL|FOREIGN KEY) constraint failed\b/.exec(text)?.[1] ?? /\bSQLITE_[A-Z_]+\b/.exec(text)?.[0];
  return kind ? `${error.name}:${kind.replace(" ", "_")}` : error.name;
}

/**
 * Reads the body as UTF-8 text, but stops (and cancels the stream) as soon as it exceeds `limit` bytes,
 * so a chunked or mislabelled upload is never buffered whole in memory. Returns null when too large.
 */
async function readBodyLimited(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Routes (the optional "/api" prefix is stripped, so the Worker can sit on vicuna-eg.com/api/*):
 *   GET     /health
 *   OPTIONS /orders   CORS preflight
 *   POST    /orders   create an order
 */
export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  return async function handle(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api(?=\/|$)/, "").replace(/\/+$/, "") || "/";
    const origin = request.headers.get("Origin");
    const originAllowed = origin !== null && deps.allowedOrigins.includes(origin);
    const cors: Record<string, string> = originAllowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        }
      : { Vary: "Origin" };

    if (path === "/health") {
      return request.method === "GET" ? json(200, { ok: true }) : json(405, { error: "method_not_allowed" });
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
        if (stored === "ok") return json(201, { order: publicOrder(order) }, cors);
      }
      return json(503, { error: "try_again" }, { ...cors, "Retry-After": "2" });
    } catch (error) {
      deps.reportError?.(errorLabel(error));
      return json(500, { error: "server_error" }, cors);
    }
  };
}
