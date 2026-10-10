import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHIPPING, egp, lookupProduct } from "@platform/commerce";
import type { Order } from "@platform/commerce";
import { MAX_BODY_BYTES, createHandler, d1Repository, memoryRepository } from "../src/index.ts";
import type { D1Like, D1Statement, HandlerDeps, OrderRepository } from "../src/index.ts";

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
    // 300 + 2 x 200 = 700 (no quantity discount), + 80 shipping
    assert.equal(order.totals.subtotal, egp(700));
    assert.equal(order.totals.discount, 0);
    assert.equal(order.totals.total, egp(780));
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

  it("stops reading a body without Content-Length once it passes the limit", async () => {
    const { handler, repository } = setup();
    const chunk = new TextEncoder().encode("x".repeat(1024));
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 10_000) controller.close(); // ~10 MB if read to the end
        else controller.enqueue(chunk);
      },
    });
    const req = new Request("https://vicuna-eg.com/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: endless,
      duplex: "half",
    } as RequestInit);
    assert.equal(req.headers.get("Content-Length"), null);
    const res = await handler(req);
    assert.equal(res.status, 413);
    assert.ok(pulled < 64, `read ${pulled} chunks, expected to stop near ${MAX_BODY_BYTES / 1024}`);
    assert.equal(repository.orders.size, 0);
  });

  const streamed = (chunks: Uint8Array[]) =>
    new Request("https://vicuna-eg.com/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          for (const c of chunks) controller.enqueue(c);
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);

  it("decodes Arabic text split across chunks in the middle of a character", async () => {
    const { handler, repository } = setup();
    const bytes = new TextEncoder().encode(JSON.stringify(body()));
    const oneByteChunks = Array.from(bytes, (b) => Uint8Array.of(b));
    const res = await handler(streamed(oneByteChunks));
    assert.equal(res.status, 201);
    assert.equal([...repository.orders.values()][0]?.customer.name, "منى أحمد");
  });

  it("accepts a body of exactly the limit and rejects one byte more", async () => {
    const { handler } = setup();
    const base = JSON.stringify(body({ pad: "" }));
    const exact = base.replace('"pad":""', `"pad":"${"x".repeat(MAX_BODY_BYTES - new TextEncoder().encode(base).length)}"`);
    assert.equal(new TextEncoder().encode(exact).length, MAX_BODY_BYTES);
    assert.equal((await handler(streamed([new TextEncoder().encode(exact)]))).status, 201);
    const over = exact.replace('"pad":"', '"pad":"x');
    assert.equal((await handler(streamed([new TextEncoder().encode(over)]))).status, 413);
  });

  it("rejects a lying Content-Length that understates the real body", async () => {
    const { handler } = setup();
    const big = JSON.stringify(body({ customer: { name: "x".repeat(MAX_BODY_BYTES) } }));
    const res = await handler(post(big, { "Content-Length": "10" }));
    assert.equal(res.status, 413);
  });

  it("accepts a multi-byte (Arabic) body just under the limit and counts bytes, not characters", async () => {
    const { handler } = setup();
    // Arabic letters are 2 bytes in UTF-8: a body of ~9000 letters is under 16384 characters but over 16384 bytes.
    const res = await handler(post(body({ padding: "م".repeat(9000) })));
    assert.equal(res.status, 413);
    const ok = await handler(post(body({ padding: "م".repeat(7000) })));
    assert.equal(ok.status, 201);
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
      ...memoryRepository(),
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
    const { handler } = setup({ repository: { ...memoryRepository(), insert: () => Promise.resolve("conflict") } });
    const res = await handler(post(body()));
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("Retry-After"), "2");
  });

  it("hides storage failures: generic 500, only an error name is reported, no customer data", async () => {
    const reported: string[] = [];
    const broken: OrderRepository = { ...memoryRepository(), insert: () => Promise.reject(new TypeError("boom 01012345678")) };
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
        const stmt: D1Statement = {
          bind(...values: unknown[]) {
            calls.push({ sql, values });
            return stmt;
          },
          all: () => Promise.resolve({ results: [] }),
          first: () => Promise.resolve(null),
          run: () => Promise.resolve({ meta: { changes: 0 } }),
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

  it("writes the order, one row per item and one stock update per item in a single batch", async () => {
    const { db, calls } = fakeD1();
    assert.equal(await d1Repository(db).insert(order), "ok");
    assert.equal(calls.length, 5);
    assert.match(calls[0]?.sql ?? "", /INSERT INTO orders/);
    assert.equal(calls[0]?.values[7], null);
    assert.equal(calls[0]?.values.length, 18);
    assert.equal(calls[0]?.values[17], null, "no promo code");
    assert.deepEqual(calls[1]?.values, ["V-1009-AAAAA", "bow-gold", "فيونكة دهبي", 20000, 2, 40000, "bow-gold"]);
    assert.match(calls[3]?.sql ?? "", /UPDATE inventory SET quantity = quantity - \?/);
    assert.deepEqual(calls[3]?.values, [2, NOW.toISOString(), "bow-gold"]);
  });

  it("maps a UNIQUE violation to conflict and rethrows anything else", async () => {
    assert.equal(await d1Repository(fakeD1(new Error("D1_ERROR: UNIQUE constraint failed: orders.id")).db).insert(order), "conflict");
    assert.equal(
      await d1Repository(fakeD1(new Error("D1_ERROR: UNIQUE constraint failed: orders.id: SQLITE_CONSTRAINT")).db).insert(order),
      "conflict",
    );
    await assert.rejects(d1Repository(fakeD1(new Error("network down")).db).insert(order), /network down/);
  });

  // Messages as SQLite reports them for this schema (checked against migrations/0001_orders.sql).
  for (const message of [
    "D1_ERROR: CHECK constraint failed: total >= 0: SQLITE_CONSTRAINT",
    "D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT",
    "D1_ERROR: UNIQUE constraint failed: order_items.order_id, order_items.product_id: SQLITE_CONSTRAINT",
    "D1_ERROR: NOT NULL constraint failed: orders.address: SQLITE_CONSTRAINT",
  ]) {
    it(`does not mistake another constraint failure for an id collision: ${message}`, async () => {
      await assert.rejects(d1Repository(fakeD1(new Error(message)).db).insert(order), (e: Error) => e.message === message);
    });
  }

  it("recognises a collision reported on error.cause", async () => {
    const wrapped = new Error("D1_ERROR", { cause: new Error("UNIQUE constraint failed: orders.id: SQLITE_CONSTRAINT") });
    assert.equal(await d1Repository(fakeD1(wrapped).db).insert(order), "conflict");
  });

  it("a data error reaches the handler as a 500 and is reported, not retried as a collision", async () => {
    const { db } = fakeD1(new Error("D1_ERROR: CHECK constraint failed: total >= 0: SQLITE_CONSTRAINT"));
    let attempts = 0;
    const repo = d1Repository(db);
    const counting: OrderRepository = { ...repo, insert: (o) => (attempts++, repo.insert(o)) };
    const reported: string[] = [];
    const { handler } = setup({ repository: counting, reportError: (n) => reported.push(n) });
    const res = await handler(post(body()));
    assert.equal(res.status, 500);
    assert.equal(attempts, 1);
    // The failure kind is logged (to tell a data bug from an outage), never the message or customer data.
    assert.deepEqual(reported, ["Error:CHECK"]);
  });
});
