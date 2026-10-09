// Promo codes through the API: preview (GET /promo), checks at order time, one use per stored order.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHIPPING, buildOrder, egp, lookupProduct, validateOrderRequest } from "@platform/commerce";
import type { Order } from "@platform/commerce";
import { createHandler, d1Repository, memoryRepository } from "../src/index.ts";
import type { OrderRepository } from "../src/index.ts";
import { sqliteD1 } from "./sqlite-d1.ts";

const ORIGIN = "https://staging.vicuna-eg.com";
const NOW = new Date("2026-10-09T10:00:00Z");

function app(repository: OrderRepository = memoryRepository()) {
  let n = 0;
  const handler = createHandler({
    lookup: lookupProduct, shipping: SHIPPING, repository, allowedOrigins: [ORIGIN],
    now: () => NOW, randomBytes: (len) => Uint8Array.from({ length: len }, () => n++),
  });
  return { handler, repository };
}

const order = (promoCode?: string, items = [{ id: "lace-black", quantity: 1 }]) =>
  new Request(`${ORIGIN}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({
      items,
      customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" },
      ...(promoCode !== undefined ? { promoCode } : {}),
    }),
  });
const preview = (code: string) => new Request(`${ORIGIN}/api/promo?code=${encodeURIComponent(code)}`, { headers: { Origin: ORIGIN } });

describe("promo codes in the order API", () => {
  it("previews a code without revealing how often it was used", async () => {
    const { handler, repository } = app();
    await repository.createPromo({ code: "WELCOME50", amount: egp(50), minSubtotal: egp(250), maxUses: 10, expiresAt: null }, NOW.toISOString());
    const res = await handler(preview(" welcome50 "));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await res.json(), { code: "WELCOME50", amount: egp(50), minSubtotal: egp(250) });
    const unknown = await handler(preview("NOPE1"));
    assert.equal(unknown.status, 422);
    assert.deepEqual(await unknown.json(), { error: "invalid_promo" });
    assert.equal((await handler(preview("<x>"))).status, 422);
  });

  it("applies the code to the order and stores it", async () => {
    const { handler, repository } = app();
    await repository.createPromo({ code: "WELCOME50", amount: egp(50), minSubtotal: 0, maxUses: null, expiresAt: null }, NOW.toISOString());
    const res = await handler(order("welcome50"));
    assert.equal(res.status, 201);
    const { order: o } = (await res.json()) as { order: Order };
    // lace 300 - 50 = 250, + 80 shipping
    assert.equal(o.totals.discount, egp(50));
    assert.equal(o.totals.total, egp(330));
    assert.equal(o.promoCode, "WELCOME50");
    assert.equal((await repository.getPromo("WELCOME50"))?.used, 1);
  });

  it("refuses expired, switched-off, used-up and below-minimum codes, and stores nothing", async () => {
    const { handler, repository } = app();
    const at = NOW.toISOString();
    await repository.createPromo({ code: "OLD10", amount: egp(10), minSubtotal: 0, maxUses: null, expiresAt: "2026-10-09T09:00:00.000Z" }, at);
    await repository.createPromo({ code: "OFF10", amount: egp(10), minSubtotal: 0, maxUses: null, expiresAt: null }, at);
    await repository.setPromoActive("OFF10", false);
    await repository.createPromo({ code: "ONCE10", amount: egp(10), minSubtotal: 0, maxUses: 1, expiresAt: null }, at);
    await repository.createPromo({ code: "BIG100", amount: egp(100), minSubtotal: egp(500), maxUses: null, expiresAt: null }, at);
    assert.equal((await handler(order("ONCE10"))).status, 201);
    for (const [code, error] of [["OLD10", "promo_expired"], ["OFF10", "invalid_promo"], ["ONCE10", "promo_used_up"], ["BIG100", "promo_min_subtotal"], ["NOSUCH", "invalid_promo"]] as const) {
      const res = await handler(order(code));
      assert.equal(res.status, 422, code);
      assert.deepEqual(((await res.json()) as { errors: Record<string, string> }).errors, { promoCode: error }, code);
    }
    assert.equal((await handler(order("BIG100", [{ id: "lace-black", quantity: 2 }]))).status, 201, "600 >= 500");
  });
});

describe("promo codes in D1", () => {
  const build = (code: string, id: string): Order => {
    const r = validateOrderRequest(
      { items: [{ id: "lace-black", quantity: 1 }], customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" } },
      lookupProduct,
    );
    if (!r.ok) throw new Error("invalid");
    return buildOrder(r.value, lookupProduct, SHIPPING, { id, now: NOW, promo: { code, amount: egp(20) } });
  };

  it("counts one use per stored order and refuses the order past the limit, all or nothing", async () => {
    const db = sqliteD1();
    const repo = d1Repository(db);
    assert.equal(await repo.createPromo({ code: "TWICE20", amount: egp(20), minSubtotal: 0, maxUses: 2, expiresAt: null }, NOW.toISOString()), "ok");
    assert.equal(await repo.createPromo({ code: "TWICE20", amount: egp(99), minSubtotal: 0, maxUses: null, expiresAt: null }, NOW.toISOString()), "exists");
    assert.equal(await repo.insert(build("TWICE20", "V-1009-AAAA1")), "ok");
    assert.equal(await repo.insert(build("TWICE20", "V-1009-AAAA2")), "ok");
    assert.equal(await repo.insert(build("TWICE20", "V-1009-AAAA3")), "promo_used_up");
    assert.equal(await repo.getOrder("V-1009-AAAA3"), null, "the third order was not stored");
    const stored = await repo.getOrder("V-1009-AAAA1");
    assert.equal(stored?.promoCode, "TWICE20");
    assert.equal(stored?.totals.discount, egp(20));
    const [p] = await repo.listPromos();
    assert.deepEqual({ used: p?.used, active: p?.active, amount: p?.amount }, { used: 2, active: true, amount: egp(20) });
    assert.equal(await repo.setPromoActive("TWICE20", false), true);
    assert.equal((await repo.getPromo("TWICE20"))?.active, false);
    assert.equal(await repo.setPromoActive("NOPE", true), false);
  });
});
