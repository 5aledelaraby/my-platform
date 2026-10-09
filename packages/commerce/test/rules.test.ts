// Business-rule table for pricing, shipping and cart limits.
// Expected values are worked out by hand from the published offer (legacy site terms: "in every 3 belts of
// one order, the 2nd is 25% off and the 3rd 35% off; the discount always lands on the cheaper belts"),
// shipping 80 EGP standard / 120 EGP express, standard free from 1500 EGP after discounts.
// They are NOT produced by running the implementation.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIMITS,
  SHIPPING,
  buildOrder,
  calculateTotals,
  catalog,
  egp,
  lookupProduct,
  remainingQuantity,
  validateOrderRequest,
} from "../src/index.ts";
import type { CartLine } from "../src/index.ts";

const line = (pounds: number, quantity = 1): CartLine => ({ unitPrice: egp(pounds), quantity });
const totalsOf = (lines: CartLine[], method: "standard" | "express" = "standard") => calculateTotals(lines, method, SHIPPING);

describe("pricing table (EGP)", () => {
  const cases: Array<[string, CartLine[], { subtotal: number; discount: number; shipping: number; total: number }]> = [
    ["one unit", [line(200)], { subtotal: 200, discount: 0, shipping: 80, total: 280 }],
    ["two equal units: 2nd is 25% off", [line(200, 2)], { subtotal: 400, discount: 50, shipping: 80, total: 430 }],
    ["three equal units: 25% + 35%", [line(200, 3)], { subtotal: 600, discount: 120, shipping: 80, total: 560 }],
    ["three different prices: discounts on the two cheaper", [line(120), line(300), line(200)], { subtotal: 620, discount: 50 + 42, shipping: 80, total: 608 }],
    ["four units: 4th starts a new group at full price", [line(200, 4)], { subtotal: 800, discount: 120, shipping: 80, total: 760 }],
    ["five units", [line(200, 5)], { subtotal: 1000, discount: 170, shipping: 80, total: 910 }],
    ["six units: two full groups", [line(200, 6)], { subtotal: 1200, discount: 240, shipping: 80, total: 1040 }],
    // sorted 300, 300, 120 | 120, 120, 120 -> 0 + 75 + 42 | 0 + 30 + 42
    ["two groups with mixed prices", [line(300, 2), line(120, 4)], { subtotal: 1080, discount: 189, shipping: 80, total: 971 }],
    ["same price split across three products", [line(200), line(200), line(200)], { subtotal: 600, discount: 120, shipping: 80, total: 560 }],
  ];
  for (const [label, lines, want] of cases) {
    it(label, () => {
      const t = totalsOf(lines);
      assert.equal(t.subtotal, egp(want.subtotal));
      assert.equal(t.discount, egp(want.discount));
      assert.equal(t.net, egp(want.subtotal - want.discount));
      assert.equal(t.shipping, egp(want.shipping));
      assert.equal(t.total, egp(want.total));
    });
  }

  it("rounds each discounted unit to the nearest piaster (half up)", () => {
    // 123.45 EGP: 25% = 30.8625 -> 30.86, 35% = 43.2075 -> 43.21
    assert.equal(totalsOf([{ unitPrice: 12345, quantity: 3 }]).discount, 3086 + 4321);
    // 0.02 EGP: 25% = 0.5 piaster -> 1
    assert.equal(totalsOf([{ unitPrice: 2, quantity: 2 }]).discount, 1);
  });

  it("allows a zero price and rejects negative, fractional or non-numeric prices", () => {
    assert.equal(totalsOf([{ unitPrice: 0, quantity: 3 }]).total, egp(80));
    for (const unitPrice of [-1, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => totalsOf([{ unitPrice, quantity: 1 }]), RangeError, String(unitPrice));
    }
  });

  it("rejects invalid quantities even when they cancel out to an empty cart", () => {
    assert.throws(() => totalsOf([line(200, 2), line(120, -2)]), RangeError);
    assert.throws(() => totalsOf([line(200, 0.5)]), RangeError);
  });

  it("returns zeros for an empty cart", () => {
    assert.deepEqual(totalsOf([]), { itemCount: 0, subtotal: 0, discount: 0, net: 0, shipping: 0, total: 0 });
    assert.deepEqual(totalsOf([line(200, 0)]), { itemCount: 0, subtotal: 0, discount: 0, net: 0, shipping: 0, total: 0 });
  });
});

describe("shipping table", () => {
  it("standard is free from 1500 EGP: just below, exactly at, just above", () => {
    assert.equal(totalsOf([{ unitPrice: egp(1500) - 1, quantity: 1 }]).shipping, egp(80));
    assert.equal(totalsOf([{ unitPrice: egp(1500), quantity: 1 }]).shipping, 0);
    assert.equal(totalsOf([{ unitPrice: egp(1500) + 1, quantity: 1 }]).shipping, 0);
  });

  it("uses the amount after discounts, not the subtotal", () => {
    // 2 x 800 = 1600, discount 200, net 1400 -> standard is charged
    const t = totalsOf([line(800, 2)]);
    assert.equal(t.subtotal, egp(1600));
    assert.equal(t.net, egp(1400));
    assert.equal(t.shipping, egp(80));
  });

  it("express is always charged, even far above the threshold", () => {
    assert.equal(totalsOf([line(3000)], "express").shipping, egp(120));
    assert.equal(totalsOf([line(3000)], "express").total, egp(3120));
  });
});

describe("server-side order totals", () => {
  const customer = { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" };

  it("ignores prices, discounts and totals sent by the client", () => {
    const tampered = {
      items: [{ id: "lace-black", quantity: 3, unitPrice: 1, price: 1, lineTotal: 1 }],
      customer,
      totals: { total: 1, discount: 99999, shipping: 0 },
      discount: 99999,
      shipping: 0,
    };
    const r = validateOrderRequest(tampered, lookupProduct);
    assert.ok(r.ok);
    if (!r.ok) return;
    const order = buildOrder(r.value, lookupProduct, SHIPPING, { id: "V-1009-AAAAA", now: new Date("2026-10-09T00:00:00Z") });
    // lace = 300 EGP: 900 - (75 + 105) = 720, + 80 shipping
    assert.equal(order.items[0]?.unitPrice, egp(300));
    assert.equal(order.totals.total, egp(800));
  });

  it("rejects unknown product ids and does not price them", () => {
    const r = validateOrderRequest({ items: [{ id: "fendi-ff", quantity: 1 }], customer }, lookupProduct);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errors["items[0].id"], "unknown_product");
    assert.equal(lookupProduct("__proto__"), undefined);
    assert.equal(lookupProduct("constructor"), undefined);
  });

  it("accepts orders exactly at each limit and rejects one past it", () => {
    const ids = catalog.products.map((p) => p.id);
    const check = (items: Array<{ id: string; quantity: number }>) => validateOrderRequest({ items, customer }, lookupProduct);
    const firstId = ids[0] ?? "";

    assert.equal(check([{ id: firstId, quantity: LIMITS.maxQuantityPerItem }]).ok, true);
    assert.equal(check([{ id: firstId, quantity: LIMITS.maxQuantityPerItem + 1 }]).ok, false);

    const fifty = [{ id: ids[0] ?? "", quantity: 20 }, { id: ids[1] ?? "", quantity: 20 }, { id: ids[2] ?? "", quantity: 10 }];
    assert.equal(check(fifty).ok, true);
    assert.equal(check([...fifty.slice(0, 2), { id: ids[2] ?? "", quantity: 11 }]).ok, false);

    const distinct = ids.slice(0, LIMITS.maxDistinctItems).map((id) => ({ id, quantity: 1 }));
    assert.equal(check(distinct).ok, true);
    assert.equal(check([...distinct, { id: ids[LIMITS.maxDistinctItems] ?? "", quantity: 1 }]).ok, false);
  });
});

describe("remainingQuantity (cart-side mirror of the API limits)", () => {
  const ids = catalog.products.map((p) => p.id);
  const a = ids[0] ?? "";
  const b = ids[1] ?? "";

  it("allows up to the per-product limit", () => {
    assert.equal(remainingQuantity([], a), LIMITS.maxQuantityPerItem);
    assert.equal(remainingQuantity([{ id: a, quantity: 19 }], a), 1);
    assert.equal(remainingQuantity([{ id: a, quantity: 20 }], a), 0);
  });

  it("stops at the total-quantity limit across products", () => {
    const cart = [{ id: a, quantity: 20 }, { id: b, quantity: 20 }];
    assert.equal(remainingQuantity(cart, ids[2] ?? ""), LIMITS.maxTotalQuantity - 40);
    assert.equal(remainingQuantity([...cart, { id: ids[2] ?? "", quantity: 10 }], ids[3] ?? ""), 0);
  });

  it("refuses a new product once the distinct-product limit is reached, but lets existing ones grow", () => {
    const full = ids.slice(0, LIMITS.maxDistinctItems).map((id) => ({ id, quantity: 1 }));
    assert.equal(remainingQuantity(full, ids[LIMITS.maxDistinctItems] ?? ""), 0);
    assert.equal(remainingQuantity(full, a), LIMITS.maxQuantityPerItem - 1);
  });

  it("counts duplicate rows for the same product together", () => {
    assert.equal(remainingQuantity([{ id: a, quantity: 10 }, { id: a, quantity: 10 }], a), 0);
    assert.equal(remainingQuantity([{ id: a, quantity: 25 }, { id: b, quantity: 25 }], ids[2] ?? ""), 0);
  });

  it("every cart it allows passes the API validation", () => {
    // Greedy fill: keep adding one unit of each product in turn while remainingQuantity allows it.
    const cart: Array<{ id: string; quantity: number }> = [];
    for (let round = 0; round < 60; round++) {
      for (const id of ids) {
        if (remainingQuantity(cart, id) === 0) continue;
        const existing = cart.find((l) => l.id === id);
        if (existing) existing.quantity += 1;
        else cart.push({ id, quantity: 1 });
      }
    }
    const r = validateOrderRequest(
      { items: cart, customer: { name: "منى أحمد", phone: "01012345678", governorate: "Cairo", address: "مدينة نصر، شارع عباس العقاد" } },
      lookupProduct,
    );
    assert.ok(r.ok, JSON.stringify(r.ok ? "" : r.errors));
    assert.equal(cart.reduce((n, l) => n + l.quantity, 0), LIMITS.maxTotalQuantity);
  });
});
