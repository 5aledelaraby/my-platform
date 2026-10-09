import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { egp, lookupProduct, normalizePromoCode, promoProblem, validateNewPromo, validateOrderRequest } from "../src/index.ts";
import type { PromoCode } from "../src/index.ts";

const NOW = new Date("2026-10-09T12:00:00Z");
const code = (over: Partial<PromoCode> = {}): PromoCode => ({
  code: "WELCOME50", amount: egp(50), minSubtotal: 0, maxUses: null, used: 0, expiresAt: null, active: true, ...over,
});

describe("promo codes", () => {
  it("normalizes what the customer types and rejects anything else", () => {
    assert.equal(normalizePromoCode(" welcome 50 "), "WELCOME50");
    assert.equal(normalizePromoCode("Eid2026"), "EID2026");
    for (const bad of ["", "AB", "A".repeat(21), "WEL-COME", "خصم50", "ＷＥＬＣＯＭＥ", 50, null, undefined]) {
      assert.equal(normalizePromoCode(bad), null, String(bad));
    }
  });

  it("says why a code cannot be used", () => {
    assert.equal(promoProblem(code(), egp(200), NOW), null);
    assert.equal(promoProblem(null, egp(200), NOW), "invalid_promo");
    assert.equal(promoProblem(code({ active: false }), egp(200), NOW), "promo_inactive");
    assert.equal(promoProblem(code({ expiresAt: "2026-10-09T12:00:00.000Z" }), egp(200), NOW), "promo_expired");
    assert.equal(promoProblem(code({ expiresAt: "2026-10-10T00:00:00.000Z" }), egp(200), NOW), null);
    assert.equal(promoProblem(code({ maxUses: 3, used: 3 }), egp(200), NOW), "promo_used_up");
    assert.equal(promoProblem(code({ maxUses: 3, used: 2 }), egp(200), NOW), null);
    assert.equal(promoProblem(code({ minSubtotal: egp(400) }), egp(399), NOW), "promo_min_subtotal");
    assert.equal(promoProblem(code({ minSubtotal: egp(400) }), egp(400), NOW), null);
  });

  it("checks a new code from the admin", () => {
    const ok = validateNewPromo({ code: "eid50", amount: egp(50), minSubtotal: egp(300), maxUses: 100, expiresAt: "2026-10-20T00:00:00Z" }, NOW);
    assert.deepEqual(ok, { ok: true, value: { code: "EID50", amount: egp(50), minSubtotal: egp(300), maxUses: 100, expiresAt: "2026-10-20T00:00:00.000Z" } });
    assert.deepEqual(validateNewPromo({ code: "SIMPLE10", amount: egp(10) }, NOW), { ok: true, value: { code: "SIMPLE10", amount: egp(10), minSubtotal: 0, maxUses: null, expiresAt: null } });
    const bad = validateNewPromo({ code: "x", amount: 0, minSubtotal: -1, maxUses: 0, expiresAt: "2026-10-01T00:00:00Z" }, NOW);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["amount", "code", "expiresAt", "maxUses", "minSubtotal"]);
    assert.equal(validateNewPromo({ code: "BIG", amount: egp(5001) }, NOW).ok, false, "typo guard");
    assert.equal(validateNewPromo({ code: "FRAC", amount: 10.5 }, NOW).ok, false);
  });

  it("takes an optional code with the order request (format only)", () => {
    const base = { items: [{ id: "lace-black", quantity: 1 }], customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" } };
    const withCode = validateOrderRequest({ ...base, promoCode: " eid50 " }, lookupProduct);
    assert.ok(withCode.ok && withCode.value.promoCode === "EID50");
    const empty = validateOrderRequest({ ...base, promoCode: "" }, lookupProduct);
    assert.ok(empty.ok && empty.value.promoCode === undefined);
    const bad = validateOrderRequest({ ...base, promoCode: "<script>" }, lookupProduct);
    assert.ok(!bad.ok && bad.errors["promoCode"] === "invalid_promo");
  });
});
