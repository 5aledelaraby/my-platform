import { LIMITS, buildOrder, generateOrderId, isUsdRate, normalizePromoCode, promoProblem, publicStock, stockShortages, toUsdCents, validateOrderRequest } from "@platform/commerce";
import type { Order, PriceLookup, PromoCode, PromoProblem, ShippingConfig } from "@platform/commerce";
import { BASE_HEADERS, MAX_BODY_BYTES, errorLabel, isRecord, json, readBodyLimited } from "./http.ts";
import { cookieValue } from "./meta.ts";
import type { BrowserSignal, PurchaseReporter } from "./meta.ts";
import type { Notifier } from "./notify.ts";
import { PAYPAL_ORDER_ID, PaypalDeclined } from "./paypal.ts";
import type { PaypalApi, PaypalOrderInfo } from "./paypal.ts";
import type { OrderRepository, StoredOrder } from "./repository.ts";

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
  allow?: (kind: RateKind, key: string) => Promise<boolean>;
  /**
   * PayPal (ADR 0014): the API with this site's credentials (sandbox on staging, live on the live site) and the
   * public client id for the buttons. Without it, or without a dollar rate set in the admin, PayPal is off.
   */
  paypal?: { api: PaypalApi; clientId: string };
  /** Tells the owner about a PayPal payment ("paid" or "pending": PayPal is still checking it). Never fails the request. */
  notifyPayment?: (order: StoredOrder, state: "paid" | "pending") => Promise<void>;
}

export type RateKind = "order" | "promo" | "payment";

const ID_ATTEMPTS = 5;
const ORDER_ID = /^[A-Z0-9-]{4,40}$/;
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
 *   GET     /paypal/config   whether PayPal is on, its public client id and the dollar rate (ADR 0014)
 *   POST    /paypal/orders   {orderId}: a PayPal order for a stored PayPal order's total, in dollars
 *   POST    /paypal/capture  {orderId, paypalOrderId}: takes the approved payment and marks the order paid
 *   (admin)           owner-only, served only on `adminHost` behind Cloudflare Access, see admin.ts
 */
export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  /**
   * PayPal (ADR 0014). The amount always comes from the stored order and the owner's rate, never from the browser.
   * A payment is checked at PayPal (our order id, dollars, amount) before the money is taken, so a mismatch never
   * takes money; and the order is marked paid only for the PayPal order recorded for it.
   */
  async function paypalRoute(path: string, body: unknown, cors: Record<string, string>): Promise<Response> {
    const paypal = deps.paypal;
    if (!paypal) return json(503, { error: "paypal_unavailable" }, cors);
    const orderId = isRecord(body) ? body["orderId"] : undefined;
    if (typeof orderId !== "string" || !ORDER_ID.test(orderId)) return json(400, { error: "invalid_request" }, cors);
    try {
      const order = await deps.repository.getOrder(orderId);
      if (!order?.paypal) return json(404, { error: "not_found" }, cors);

      const recorded = order.paypal;
      const matches = (info: PaypalOrderInfo) => info.customId === order.id && info.currency === "USD" && info.cents === recorded.usdCents;

      /**
       * Records the result of a PayPal order whose money was taken (status COMPLETED). The state is always read
       * back from PayPal in full (a capture's own reply may leave fields out), and checked again.
       */
      const settle = async (paypalOrderId: string, info: PaypalOrderInfo): Promise<Response> => {
        const capture = info.capture;
        if (!capture || capture.status === "DECLINED" || capture.status === "FAILED") return json(402, { error: "payment_declined" }, cors);
        if (capture.status === "PENDING") {
          if (deps.notifyPayment) {
            const sent = deps.notifyPayment(order, "pending").catch((error: unknown) => deps.reportError?.(`notify_failed:${errorLabel(error)}`));
            deps.waitUntil?.(sent);
          }
          return json(202, { paid: false, pending: true }, cors);
        }
        if (capture.status !== "COMPLETED" || !matches(info)) {
          deps.reportError?.(`paypal_capture_unexpected:${capture.status.replace(/[^A-Z_]/g, "").slice(0, 30)}`);
          return json(502, { error: "payment_unclear" }, cors);
        }
        const now = deps.now().toISOString();
        const result = await deps.repository.markPaid(order.id, paypalOrderId, capture.id, now);
        if (result === "not_found") return json(409, { error: "payment_mismatch" }, cors);
        if (result === "ok" && deps.notifyPayment) {
          const paid: StoredOrder = { ...order, paypal: { ...recorded, captureId: capture.id, paidAt: now } };
          const sent = deps.notifyPayment(paid, "paid").catch((error: unknown) => deps.reportError?.(`notify_failed:${errorLabel(error)}`));
          deps.waitUntil?.(sent);
        }
        return json(200, { paid: true }, cors);
      };

      if (path === "/paypal/orders") {
        if (recorded.paidAt) return json(409, { error: "already_paid" }, cors);
        if (order.status === "cancelled") return json(409, { error: "order_cancelled" }, cors);
        // Never charge twice: if the PayPal order made earlier was already paid (the page lost the answer), record
        // that instead of making a new one.
        if (recorded.orderId) {
          const earlier = await paypal.api.getOrder(recorded.orderId);
          if (earlier.status === "COMPLETED") {
            const settled = await settle(recorded.orderId, earlier);
            if (settled.status === 200) return json(409, { error: "already_paid" }, cors);
            return settled;
          }
        }
        const rate = await deps.repository.usdRate();
        if (rate === null || !isUsdRate(rate)) return json(503, { error: "paypal_unavailable" }, cors);
        const usdCents = toUsdCents(order.totals.total, rate);
        // A promo code can bring a pickup order to 0: there is nothing to pay, and PayPal refuses an order for $0.00.
        if (usdCents === 0) return json(409, { error: "nothing_to_pay" }, cors);
        const id = await paypal.api.createOrder({ orderId: order.id, usdCents, description: `Vicuna order ${order.id}` });
        if (!(await deps.repository.setPaypalOrder(order.id, id, usdCents))) return json(409, { error: "already_paid" }, cors);
        return json(201, { id, usdCents }, cors);
      }

      // POST /paypal/capture
      const paypalOrderId = isRecord(body) ? body["paypalOrderId"] : undefined;
      if (typeof paypalOrderId !== "string" || !PAYPAL_ORDER_ID.test(paypalOrderId)) return json(400, { error: "invalid_request" }, cors);
      if (recorded.orderId !== paypalOrderId) return json(409, { error: "payment_mismatch" }, cors);
      if (recorded.paidAt) return json(200, { paid: true }, cors);

      const before = await paypal.api.getOrder(paypalOrderId);
      if (!matches(before)) {
        deps.reportError?.("paypal_mismatch");
        return json(409, { error: "payment_mismatch" }, cors);
      }
      if (before.status === "APPROVED") await paypal.api.captureOrder(paypalOrderId);
      else if (before.status !== "COMPLETED") return json(409, { error: "not_approved" }, cors);
      return await settle(paypalOrderId, await paypal.api.getOrder(paypalOrderId));
    } catch (error) {
      if (error instanceof PaypalDeclined) return json(402, { error: "payment_declined" }, cors);
      // paypal.ts errors are fixed labels (status and PayPal's issue name), safe to log; any other message is not.
      const label = error instanceof Error && /^paypal_[a-z0-9_A-Z]{1,60}$/.test(error.message) ? error.message : errorLabel(error);
      deps.reportError?.(`paypal_failed:${label}`);
      // PayPal's own labels (HTTP status and issue name, e.g. "paypal_http_422_PAYEE_ACCOUNT_RESTRICTED") carry no
      // secret and no customer data, and tell the owner why PayPal refused; anything else stays hidden.
      return json(502, { error: "paypal_error", ...(label.startsWith("paypal_") ? { detail: label } : {}) }, cors);
    }
  }

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
    const limited = async (kind: RateKind) => (deps.allow ? !(await deps.allow(kind, visitor).catch(() => true)) : false);
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

    if (path === "/paypal/config") {
      if (request.method !== "GET") return json(405, { error: "method_not_allowed" }, { Allow: "GET" });
      const headers = { ...cors, "Cache-Control": "public, max-age=60" };
      if (!deps.paypal) return json(200, { enabled: false }, headers);
      try {
        const rate = await deps.repository.usdRate();
        if (rate === null || !isUsdRate(rate)) return json(200, { enabled: false }, headers);
        return json(200, { enabled: true, clientId: deps.paypal.clientId, usdRate: rate }, headers);
      } catch (error) {
        deps.reportError?.(`paypal_config_failed:${errorLabel(error)}`);
        return json(200, { enabled: false }, { ...cors, "Cache-Control": "no-store" });
      }
    }

    const isPaypal = path === "/paypal/orders" || path === "/paypal/capture";
    if (path !== "/orders" && !isPaypal) return json(404, { error: "not_found" });

    if (request.method === "OPTIONS") {
      return originAllowed ? new Response(null, { status: 204, headers: { ...BASE_HEADERS, ...cors } }) : json(403, { error: "forbidden_origin" });
    }
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, { Allow: "POST, OPTIONS" });

    if (!originAllowed) return json(403, { error: "forbidden_origin" });
    if (await limited(isPaypal ? "payment" : "order")) return json(429, { error: "too_many_requests" }, { ...cors, "Retry-After": "60" });
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

    if (isPaypal) return paypalRoute(path, body, cors);

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
