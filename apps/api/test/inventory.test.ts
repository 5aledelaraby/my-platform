// Inventory and status changes against a real SQLite database with the real migrations (see sqlite-d1.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHIPPING, buildOrder, lookupProduct, validateOrderRequest } from "@platform/commerce";
import type { Order } from "@platform/commerce";
import { createHandler, d1Repository } from "../src/index.ts";
import { sqliteD1 } from "./sqlite-d1.ts";

const NOW = new Date("2026-10-09T10:00:00Z");
const customer = { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" };
let n = 0;

function makeOrder(items: Array<{ id: string; quantity: number }>): Order {
  const r = validateOrderRequest({ items, customer }, lookupProduct);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  n += 1;
  return buildOrder(r.value, lookupProduct, SHIPPING, { id: `V-1009-T${String(n).padStart(4, "0")}`, now: NOW });
}

function setup() {
  const db = sqliteD1();
  const repo = d1Repository(db);
  const count = (sql: string) => Number((db.sqlite.prepare(sql).get() as { c: number }).c);
  const qty = (id: string) => (db.sqlite.prepare("SELECT quantity FROM inventory WHERE product_id = ?").get(id) as { quantity: number } | undefined)?.quantity;
  return { db, repo, count, qty };
}

describe("taking stock with an order", () => {
  it("leaves untracked products unlimited and marks nothing as taken", async () => {
    const { repo, db, count } = setup();
    assert.equal(await repo.insert(makeOrder([{ id: "lace-black", quantity: 20 }])), "ok");
    assert.equal(count("SELECT COUNT(*) AS c FROM inventory"), 0);
    assert.equal((db.sqlite.prepare("SELECT stock_taken FROM order_items").get() as { stock_taken: number }).stock_taken, 0);
  });

  it("takes units from tracked products in the same transaction", async () => {
    const { repo, qty, db } = setup();
    await repo.setStock("lace-black", 5, null, NOW.toISOString());
    assert.equal(await repo.insert(makeOrder([{ id: "lace-black", quantity: 2 }, { id: "bow-gold", quantity: 1 }])), "ok");
    assert.equal(qty("lace-black"), 3);
    const taken = db.sqlite.prepare("SELECT product_id, stock_taken FROM order_items ORDER BY product_id").all();
    assert.deepEqual(taken.map((r) => ({ ...r })), [{ product_id: "bow-gold", stock_taken: 0 }, { product_id: "lace-black", stock_taken: 1 }]);
  });

  it("refuses the whole order when one tracked product would go below zero, and stores nothing", async () => {
    const { repo, qty, count } = setup();
    await repo.setStock("lace-black", 1, null, NOW.toISOString());
    await repo.setStock("bow-gold", 9, null, NOW.toISOString());
    const result = await repo.insert(makeOrder([{ id: "bow-gold", quantity: 2 }, { id: "lace-black", quantity: 2 }]));
    assert.equal(result, "out_of_stock");
    assert.equal(count("SELECT COUNT(*) AS c FROM orders"), 0);
    assert.equal(count("SELECT COUNT(*) AS c FROM order_items"), 0);
    assert.equal(qty("bow-gold"), 9, "rolled back");
    assert.equal(qty("lace-black"), 1);
  });

  it("sells the last unit exactly once", async () => {
    const { repo, qty } = setup();
    await repo.setStock("croc-black", 1, null, NOW.toISOString());
    assert.equal(await repo.insert(makeOrder([{ id: "croc-black", quantity: 1 }])), "ok");
    assert.equal(qty("croc-black"), 0);
    assert.equal(await repo.insert(makeOrder([{ id: "croc-black", quantity: 1 }])), "out_of_stock");
  });

  it("still reports an id collision as a collision", async () => {
    const { repo } = setup();
    const order = makeOrder([{ id: "lace-black", quantity: 1 }]);
    assert.equal(await repo.insert(order), "ok");
    assert.equal(await repo.insert(order), "conflict");
  });
});

describe("status changes", () => {
  it("cancelling returns exactly the units the order took, once", async () => {
    const { repo, qty } = setup();
    await repo.setStock("lace-black", 5, null, NOW.toISOString());
    const order = makeOrder([{ id: "lace-black", quantity: 2 }, { id: "bow-gold", quantity: 1 }]);
    await repo.insert(order);
    assert.equal(qty("lace-black"), 3);
    assert.equal(await repo.setStatus(order.id, "new", "cancelled", 0, NOW.toISOString(), "c1"), "ok");
    assert.equal(qty("lace-black"), 5);
    assert.equal(qty("bow-gold"), undefined, "an untracked product is not created by a cancellation");
    // A second tab still holding version 0 tries to cancel again: nothing changes.
    assert.equal(await repo.setStatus(order.id, "new", "cancelled", 0, NOW.toISOString(), "c2"), "stale");
    assert.equal(qty("lace-black"), 5);
  });

  it("does not return units that were never taken (product tracked only after the order)", async () => {
    const { repo, qty } = setup();
    const order = makeOrder([{ id: "ruffle-red", quantity: 2 }]);
    await repo.insert(order);
    await repo.setStock("ruffle-red", 4, null, NOW.toISOString());
    assert.equal(await repo.setStatus(order.id, "new", "cancelled", 0, NOW.toISOString(), "c1"), "ok");
    assert.equal(qty("ruffle-red"), 4);
  });

  it("moves through confirmed and shipped, bumping the version, and a returned shipment gives the stock back", async () => {
    const { repo, qty } = setup();
    await repo.setStock("snake-grey", 3, null, NOW.toISOString());
    const order = makeOrder([{ id: "snake-grey", quantity: 1 }]);
    await repo.insert(order);
    assert.equal(await repo.setStatus(order.id, "new", "confirmed", 0, NOW.toISOString(), "a"), "ok");
    assert.equal(await repo.setStatus(order.id, "confirmed", "shipped", 1, NOW.toISOString(), "b"), "ok");
    assert.equal(qty("snake-grey"), 2);
    assert.equal(await repo.setStatus(order.id, "shipped", "cancelled", 2, NOW.toISOString(), "c"), "ok");
    assert.equal(qty("snake-grey"), 3);
    const stored = await repo.getOrder(order.id);
    assert.equal(stored?.status, "cancelled");
    assert.equal(stored?.version, 3);
  });

  it("reports an unknown order", async () => {
    const { repo } = setup();
    assert.equal(await repo.setStatus("V-0000-NOPE0", "new", "confirmed", 0, NOW.toISOString(), "x"), "not_found");
  });
});

describe("reading orders and stock", () => {
  it("round-trips an order with its items and customer", async () => {
    const { repo } = setup();
    const order = makeOrder([{ id: "bow-gold", quantity: 2 }, { id: "lace-black", quantity: 1 }]);
    await repo.insert(order);
    const stored = await repo.getOrder(order.id);
    assert.deepEqual({ ...stored, version: undefined, updatedAt: undefined }, { ...order, version: undefined, updatedAt: undefined });
    assert.equal(stored?.version, 0);
  });

  it("lists newest first and filters by status", async () => {
    const { repo } = setup();
    const a = makeOrder([{ id: "bow-gold", quantity: 1 }]);
    const b = { ...makeOrder([{ id: "lace-black", quantity: 1 }]), createdAt: "2026-10-09T11:00:00.000Z" };
    await repo.insert(a);
    await repo.insert(b);
    await repo.setStatus(a.id, "new", "confirmed", 0, NOW.toISOString(), "x");
    assert.deepEqual((await repo.listOrders({ limit: 10 })).map((o) => o.id), [b.id, a.id]);
    assert.deepEqual((await repo.listOrders({ status: "confirmed", limit: 10 })).map((o) => o.id), [a.id]);
    const [first] = await repo.listOrders({ limit: 1 });
    assert.equal(first?.customerPhone, "01012345678");
  });

  it("sets, updates and stops tracking stock", async () => {
    const { repo } = setup();
    await repo.setStock("bow-gold", 4, null, NOW.toISOString());
    await repo.setStock("bow-gold", 7, 4, NOW.toISOString());
    assert.deepEqual([...(await repo.stock())], [["bow-gold", 7]]);
    await repo.setStock("bow-gold", null, 7, NOW.toISOString());
    assert.equal((await repo.stock()).size, 0);
  });

  it("refuses negative stock at the database level too", async () => {
    const { repo } = setup();
    await assert.rejects(repo.setStock("bow-gold", -1, null, NOW.toISOString()), /stock_not_negative/);
  });
});

describe("migration 0002 on a database that already has orders", () => {
  it("keeps old orders readable and cancellable without touching stock", async () => {
    const db = sqliteD1({ upTo: "0001_orders.sql" });
    db.sqlite
      .prepare(
        `INSERT INTO orders (id, created_at, status, customer_name, customer_phone, governorate, address, notes, shipping_method,
payment_method, item_count, subtotal, discount, net, shipping, total) VALUES ('V-1009-OLD01', '2026-10-09T05:31:00.000Z', 'new',
'منى', '01012345678', 'القاهرة', 'عنوان قديم طويل', NULL, 'express', 'instapay', 1, 20000, 0, 20000, 12000, 32000)`,
      )
      .run();
    db.sqlite.prepare("INSERT INTO order_items VALUES ('V-1009-OLD01', 'bow-gold', 'فيونكة دهبي', 20000, 1, 20000)").run();
    db.migrate("0002_inventory.sql");
    const repo = d1Repository(db);
    await repo.setStock("bow-gold", 2, null, NOW.toISOString());
    const old = await repo.getOrder("V-1009-OLD01");
    assert.equal(old?.version, 0);
    assert.equal(old?.totals.total, 32000);
    assert.equal(await repo.setStatus("V-1009-OLD01", "new", "cancelled", 0, NOW.toISOString(), "x"), "ok");
    assert.deepEqual([...(await repo.stock())], [["bow-gold", 2]]);
  });
});

describe("order API with stock", () => {
  const ORIGIN = "https://staging.vicuna-eg.com";
  const post = (items: unknown) =>
    new Request(`${ORIGIN}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ items, customer }),
    });

  function api() {
    const db = sqliteD1();
    const repo = d1Repository(db);
    let i = 0;
    const handler = createHandler({
      lookup: lookupProduct,
      shipping: SHIPPING,
      repository: repo,
      allowedOrigins: [ORIGIN],
      now: () => NOW,
      randomBytes: (len) => Uint8Array.from({ length: len }, () => i++),
    });
    return { handler, repo };
  }

  it("answers 409 with what is left when stock runs out, and the cart can retry with less", async () => {
    const { handler, repo } = api();
    await repo.setStock("lace-black", 1, null, NOW.toISOString());
    const res = await handler(post([{ id: "lace-black", quantity: 2 }, { id: "bow-gold", quantity: 1 }]));
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: "out_of_stock", items: [{ id: "lace-black", available: 1 }] });
    assert.equal((await handler(post([{ id: "lace-black", quantity: 1 }]))).status, 201);
    assert.equal((await handler(post([{ id: "lace-black", quantity: 1 }]))).status, 409);
  });

  it("GET /api/stock shows tracked products only, capped at 20, cacheable for 30 seconds", async () => {
    const { handler, repo } = api();
    await repo.setStock("lace-black", 0, null, NOW.toISOString());
    await repo.setStock("bow-gold", 500, null, NOW.toISOString());
    const res = await handler(new Request(`${ORIGIN}/api/stock`));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=30");
    assert.deepEqual(await res.json(), { stock: { "lace-black": 0, "bow-gold": 20 } });
    assert.equal((await handler(new Request(`${ORIGIN}/api/stock`, { method: "POST" }))).status, 405);
  });
});

describe("schema check and status guard", () => {
  it("health reports an outdated schema with 503, and 200 once migration 0002 is applied", async () => {
    const db = sqliteD1({ upTo: "0001_orders.sql" });
    const handler = createHandler({
      lookup: lookupProduct, shipping: SHIPPING, repository: d1Repository(db), allowedOrigins: [],
      now: () => NOW, randomBytes: (len) => new Uint8Array(len),
    });
    const health = () => handler(new Request("https://staging.vicuna-eg.com/api/health"));
    const before = await health();
    assert.equal(before.status, 503);
    assert.deepEqual(await before.json(), { ok: false, error: "schema_outdated" });
    db.migrate("0002_inventory.sql");
    assert.equal((await health()).status, 200);
  });

  it("a status change based on the wrong current status changes nothing and returns no stock", async () => {
    const { repo, qty } = setup();
    await repo.setStock("lace-red", 5, null, NOW.toISOString());
    const order = makeOrder([{ id: "lace-red", quantity: 2 }]);
    await repo.insert(order);
    assert.equal(await repo.setStatus(order.id, "new", "cancelled", 0, NOW.toISOString(), "a"), "ok");
    assert.equal(qty("lace-red"), 5);
    // Same version number but the order is no longer "new": refused.
    assert.equal(await repo.setStatus(order.id, "new", "cancelled", 1, NOW.toISOString(), "b"), "stale");
    assert.equal(qty("lace-red"), 5);
  });
});
