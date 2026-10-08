import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHIPPING, egp, lookupProduct } from "@platform/commerce";
import type { Order } from "@platform/commerce";
import { MAX_BODY_BYTES, createHandler, d1Repository, memoryRepository } from "../src/index.ts";
import type { D1Like, HandlerDeps, OrderRepository } from "../src/index.ts";

const ORIGIN = "https://vicuna-eg.com";
const NOW = new Date("2026-10-09T10:00:00Z");

function setup(overrides: Partial<HandlerDeps> = {}) {
  const repository = memoryRepository();
  let counter = 0;
  const reported: string[] = [];
  const handler = createHandler({
    lookup: lookupProduct,
    shipping: SHIPPING,
    repository,
    allowedOrigins: [ORIGIN, "https://staging.vicuna-eg.com"],
    now: () => NOW,
    // Different bytes on every call so that retries produce different ids.
    randomBytes: (n) => Uint8Array.from({ length: n }, () => counter++),
    reportError: (name) => reported.push(name),
    ...overrides,
  });
  return { handler, repository, reported };
}

const body = (extra: Record<string, unknown> = {}) => ({
  items: [{ id: "bow-gold", quantity: 2 }, { id: "lace-black", quantity: 1 }],
  customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد، عمارة 21" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  ...extra,
});

const post = (payload: unknown, headers: Record<string, string> = {}, path = "/api/orders") =>
  new Request(`https://vicuna-eg.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });

describe("health and routing", () => {
  it("GET /health", async () => {
    const { handler } = setup();
    const res = await handler(new Request("https://vicuna-eg.com/api/health"));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });
  it("404 for unknown paths, 405 for GET /orders", async () => {
    const { handler } = setup();
    assert.equal((await handler(new Request("https://vicuna-eg.com/api/nope"))).status, 404);
    const res = await handler(new Request("https://vicuna-eg.com/api/orders"));
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("Allow"), "POST, OPTIONS");
  });
  it("works with and without the /api prefix and trailing slash", async () => {
    const { handler } = setup();
    assert.equal((await handler(post(body(), {}, "/orders"))).status, 201);
    assert.equal((await handler(post(body(), {}, "/api/orders/"))).status, 201);
  });
});

describe("CORS", () => {
  it("answers the preflight for an allowed origin", async () => {
    const { handler } = setup();
    const res = await handler(new Request("https://vicuna-eg.com/api/orders", { method: "OPTIONS", headers: { Origin: ORIGIN } }));
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    assert.equal(res.headers.get("Vary"), "Origin");
  });
  it("rejects the preflight for any other origin", async () => {
    const { handler } = setup();
    const res = await handler(new Request("https://vicuna-eg.com/api/orders", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }));
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  });
});

describe("POST /orders", () => {
  it("creates the order, recomputes totals on the server and stores a snapshot", async () => {
    const { handler, repository } = setup();
    const res = await handler(post(body()));
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    const { order } = (await res.json()) as { order: Record<string, unknown> & { totals: Order["totals"] } };
    // 300 + 200 (25% off) + 200 (35% off) = 700 - 120 = 580, + 80 shipping
    assert.equal(order.totals.subtotal, egp(700));
    assert.equal(order.totals.discount, egp(120));
    assert.equal(order.totals.total, egp(660));
    assert.match(String(order["id"]), /^V-1009-[2-9A-HJ-NP-Z]{5}$/);
    assert.equal(order["firstName"], "منى");
    assert.equal(repository.orders.size, 1);
    const stored = repository.orders.get(String(order["id"]));
    assert.equal(stored?.customer.phone, "01012345678");
    assert.equal(stored?.items.find((i) => i.productId === "lace-black")?.unitPrice, egp(300));
  });

  it("does not echo phone or address back", async () => {
    const { handler } = setup();
    const text = await (await handler(post(body()))).text();
    assert.equal(text.includes("01012345678"), false);
    assert.equal(text.includes("عباس العقاد"), false);
  });

  it("ignores prices and totals sent by the client", async () => {
    const { handler, repository } = setup();
    const tampered = body({ total: 1, items: [{ id: "lace-black", quantity: 1, price: 1, unitPrice: 1 }] });
    const res = await handler(post(tampered));
    assert.equal(res.status, 201);
    const stored = [...repository.orders.values()][0];
    assert.equal(stored?.totals.subtotal, egp(300));
    assert.equal(stored?.items[0]?.unitPrice, egp(300));
  });

  it("returns 422 with error codes for invalid input and stores nothing", async () => {
    const { handler, repository } = setup();
    const res = await handler(post(body({ customer: { name: "م", phone: "123", governorate: "x", address: "y" } })));
    assert.equal(res.status, 422);
    const data = (await res.json()) as { error: string; errors: Record<string, string> };
    assert.equal(data.error, "validation_failed");
    assert.equal(data.errors["customer.phone"], "invalid_phone");
    assert.equal(data.errors["customer.name"], "too_short");
    assert.equal(repository.orders.size, 0);
  });

  it("rejects requests from other origins or with no Origin header", async () => {
    const { handler, repository } = setup();
    assert.equal((await handler(post(body(), { Origin: "https://evil.example" }))).status, 403);
    const noOrigin = new Request("https://vicuna-eg.com/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body()),
    });
    assert.equal((await handler(noOrigin)).status, 403);
    assert.equal(repository.orders.size, 0);
  });

  it("rejects a wrong content type, invalid JSON and oversized bodies", async () => {
    const { handler } = setup();
    assert.equal((await handler(post(body(), { "Content-Type": "text/plain" }))).status, 415);
    assert.equal((await handler(post("{not json"))).status, 400);
    assert.equal((await handler(post("x".repeat(MAX_BODY_BYTES + 1)))).status, 413);
  });

  it("silently refuses bots that fill the honeypot field", async () => {
    const { handler, repository } = setup();
    const res = await handler(post(body({ website: "http://spam.example" })));
    assert.equal(res.status, 400);
    assert.equal(repository.orders.size, 0);
  });

  it("retries on an order-id collision", async () => {
    const attempts: string[] = [];
    const flaky: OrderRepository = {
      insert(order) {
        attempts.push(order.id);
        return Promise.resolve(attempts.length < 3 ? "conflict" : "ok");
      },
    };
    const { handler } = setup({ repository: flaky });
    const res = await handler(post(body()));
    assert.equal(res.status, 201);
    assert.equal(attempts.length, 3);
    assert.equal(new Set(attempts).size, 3);
  });

  it("answers 503 when every id attempt collides", async () => {
    const { handler } = setup({ repository: { insert: () => Promise.resolve("conflict") } });
    const res = await handler(post(body()));
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("Retry-After"), "2");
  });

  it("hides storage failures: generic 500, only an error name is reported, no customer data", async () => {
    const reported: string[] = [];
    const broken: OrderRepository = { insert: () => Promise.reject(new TypeError("boom 01012345678")) };
    const { handler } = setup({ repository: broken, reportError: (n) => reported.push(n) });
    const res = await handler(post(body()));
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: "server_error" });
    assert.deepEqual(reported, ["TypeError"]);
  });
});

describe("d1Repository", () => {
  function fakeD1(failWith?: Error) {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db: D1Like = {
      prepare(sql) {
        const stmt = {
          bind(...values: unknown[]) {
            calls.push({ sql, values });
            return stmt;
          },
        };
        return stmt;
      },
      batch() {
        return failWith ? Promise.reject(failWith) : Promise.resolve([]);
      },
    };
    return { db, calls };
  }

  const order: Order = {
    id: "V-1009-AAAAA", createdAt: NOW.toISOString(), status: "new",
    customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "عنوان طويل بما يكفي" },
    items: [
      { productId: "bow-gold", name: "فيونكة دهبي", unitPrice: 20000, quantity: 2, lineTotal: 40000 },
      { productId: "lace-black", name: "دانتيل أسود", unitPrice: 30000, quantity: 1, lineTotal: 30000 },
    ],
    shippingMethod: "standard", paymentMethod: "cod",
    totals: { itemCount: 3, subtotal: 70000, discount: 12000, net: 58000, shipping: 8000, total: 66000 },
  };

  it("writes the order and one row per item in a single batch, with notes as NULL when absent", async () => {
    const { db, calls } = fakeD1();
    assert.equal(await d1Repository(db).insert(order), "ok");
    assert.equal(calls.length, 3);
    assert.match(calls[0]?.sql ?? "", /INSERT INTO orders/);
    assert.equal(calls[0]?.values[7], null);
    assert.equal(calls[0]?.values.length, 16);
    assert.deepEqual(calls[1]?.values, ["V-1009-AAAAA", "bow-gold", "فيونكة دهبي", 20000, 2, 40000]);
  });

  it("maps a UNIQUE violation to conflict and rethrows anything else", async () => {
    assert.equal(await d1Repository(fakeD1(new Error("D1_ERROR: UNIQUE constraint failed: orders.id")).db).insert(order), "conflict");
    await assert.rejects(d1Repository(fakeD1(new Error("network down")).db).insert(order), /network down/);
  });
});
