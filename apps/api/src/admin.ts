// Owner-only admin: orders (view, change status) and stock. Everything here requires a verified owner
// (Cloudflare Access JWT, see access.ts). Mutations also require a custom header and a same-origin request,
// so another site cannot make the owner's browser change anything (CSRF).
import { canTransition, catalog, isOrderStatus, nextStatuses } from "@platform/commerce";
import type { OrderStatus } from "@platform/commerce";
import type { AdminVerifier } from "./access.ts";
import { ADMIN_CSS, ADMIN_HTML, ADMIN_JS } from "./admin-ui.ts";
import { errorLabel, isRecord, json, readBodyLimited } from "./http.ts";
import type { OrderRepository } from "./repository.ts";

export interface AdminDeps {
  repository: OrderRepository;
  /** null when Access is not configured yet: admin answers 503 and shows nothing. */
  verify: AdminVerifier | null;
  now: () => Date;
  randomBytes: (length: number) => Uint8Array;
  reportError?: (label: string) => void;
}

export const ADMIN_HEADER = "X-Vicuna-Admin";
const MAX_ADMIN_BODY = 4 * 1024;
const MAX_STOCK = 100_000;
const LIST_LIMIT_MAX = 200;

const PAGE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
} as const;

const page = (body: string, type: string, status = 200) =>
  new Response(body, { status, headers: { ...PAGE_HEADERS, "Content-Type": `${type}; charset=utf-8` } });

const NOT_CONFIGURED_HTML = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>الإدارة غير مفعلة</title><p>صفحة الإدارة غير مفعلة بعد: أضف إعدادات Cloudflare Access (ACCESS_TEAM_DOMAIN و ACCESS_AUD و ADMIN_EMAILS).</p></html>`;

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const products = catalog.products.map((p) => {
  const style = catalog.styles.find((s) => s.id === p.style);
  return { id: p.id, name: p.name, style: p.style, styleName: style?.name ?? p.style };
});
const productIds = new Set(products.map((p) => p.id));

export function createAdminHandler(deps: AdminDeps): (request: Request, path: string) => Promise<Response> {
  return async (request, path) => {
    if (!deps.verify) {
      return path === "/admin" ? page(NOT_CONFIGURED_HTML, "text/html", 503) : json(503, { error: "admin_not_configured" });
    }
    let email: string | null = null;
    try {
      email = await deps.verify(request);
    } catch (error) {
      deps.reportError?.(`admin_auth_failed:${errorLabel(error)}`);
    }
    if (!email) return json(403, { error: "forbidden" });

    const method = request.method;
    const url = new URL(request.url);

    // The page and its files.
    if (method === "GET" && path === "/admin") return page(ADMIN_HTML, "text/html");
    if (method === "GET" && path === "/admin/app.js") return page(ADMIN_JS, "text/javascript");
    if (method === "GET" && path === "/admin/app.css") return page(ADMIN_CSS, "text/css");

    if (!path.startsWith("/admin/api/")) return json(404, { error: "not_found" });
    const route = path.slice("/admin/api".length); // e.g. "/orders/V-1009-ABCDE/status"

    let body: Record<string, unknown> = {};
    if (method === "POST" || method === "PUT") {
      const origin = request.headers.get("Origin");
      if (request.headers.get(ADMIN_HEADER) !== "1" || (origin !== null && origin !== url.origin)) {
        return json(403, { error: "forbidden" });
      }
      if (!(request.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
        return json(415, { error: "unsupported_media_type" });
      }
      const raw = await readBodyLimited(request, MAX_ADMIN_BODY);
      if (raw === null) return json(413, { error: "payload_too_large" });
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return json(400, { error: "invalid_json" });
        body = parsed;
      } catch {
        return json(400, { error: "invalid_json" });
      }
    }

    try {
      // GET /orders?status=new&limit=50
      if (method === "GET" && route === "/orders") {
        const status = url.searchParams.get("status");
        if (status && !isOrderStatus(status)) return json(400, { error: "invalid_status" });
        const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit") ?? "50")) || 50, 1), LIST_LIMIT_MAX);
        const orders = await deps.repository.listOrders({ ...(status ? { status: status as OrderStatus } : {}), limit });
        return json(200, { orders });
      }

      const orderMatch = /^\/orders\/([A-Z0-9-]{4,40})(\/status)?$/.exec(route);
      if (orderMatch) {
        const id = orderMatch[1] ?? "";
        // GET /orders/:id
        if (method === "GET" && !orderMatch[2]) {
          const order = await deps.repository.getOrder(id);
          return order ? json(200, { order, next: nextStatuses(order.status) }) : json(404, { error: "not_found" });
        }
        // POST /orders/:id/status  {to, version}
        if (method === "POST" && orderMatch[2]) {
          const to = body["to"];
          const version = body["version"];
          if (!isOrderStatus(to) || typeof version !== "number" || !Number.isInteger(version)) {
            return json(400, { error: "invalid_request" });
          }
          const order = await deps.repository.getOrder(id);
          if (!order) return json(404, { error: "not_found" });
          if (order.version !== version) return json(409, { error: "stale" });
          if (!canTransition(order.status, to)) return json(409, { error: "invalid_transition" });
          const result = await deps.repository.setStatus(id, order.status, to, version, deps.now().toISOString(), hex(deps.randomBytes(12)));
          if (result === "not_found") return json(404, { error: "not_found" });
          if (result === "stale") return json(409, { error: "stale" });
          const updated = await deps.repository.getOrder(id);
          return json(200, { order: updated, next: updated ? nextStatuses(updated.status) : [] });
        }
        return json(405, { error: "method_not_allowed" });
      }

      // GET /stock: available units per product (null = untracked) and units held by open (unshipped) orders.
      if (method === "GET" && route === "/stock") {
        const [stock, reserved] = await Promise.all([deps.repository.stock(), deps.repository.reserved()]);
        return json(200, {
          products: products.map((p) => ({ ...p, quantity: stock.get(p.id) ?? null, reserved: reserved.get(p.id) ?? 0 })),
        });
      }

      // PUT /stock/:productId  {quantity, expected}: integer >= 0 or null (untracked). `expected` is the value the
      // owner saw; if an order changed it meanwhile, nothing is saved and 409 returns the current value.
      const stockMatch = /^\/stock\/([a-z0-9-]{1,60})$/.exec(route);
      if (stockMatch && method === "PUT") {
        const id = stockMatch[1] ?? "";
        if (!productIds.has(id)) return json(404, { error: "not_found" });
        const isQty = (v: unknown) => v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_STOCK);
        const quantity = body["quantity"];
        const expected = body["expected"];
        if (!isQty(quantity) || !("expected" in body) || !isQty(expected)) return json(400, { error: "invalid_quantity" });
        const result = await deps.repository.setStock(id, quantity as number | null, expected as number | null, deps.now().toISOString());
        if (!result.ok) return json(409, { error: "stale", current: result.current });
        return json(200, { id, quantity });
      }

      return json(404, { error: "not_found" });
    } catch (error) {
      deps.reportError?.(`admin_failed:${errorLabel(error)}`);
      return json(500, { error: "server_error" });
    }
  };
}
