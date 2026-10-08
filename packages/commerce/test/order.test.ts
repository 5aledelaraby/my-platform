import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GOVERNORATES,
  GOVERNORATES_EN,
  LIMITS,
  SHIPPING,
  buildOrder,
  catalog,
  egp,
  generateOrderId,
  lookupProduct,
  normalizeEgyptianMobile,
  validateOrderRequest,
} from "../src/index.ts";

const validBody = () => ({
  items: [{ id: "lace-black", quantity: 1 }],
  customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد، عمارة 21" },
  shippingMethod: "standard",
  paymentMethod: "cod",
});

describe("catalogue", () => {
  it("has 38 products with unique ids, each priced by a known style", () => {
    assert.equal(catalog.products.length, 38);
    assert.equal(new Set(catalog.products.map((p) => p.id)).size, 38);
    for (const p of catalog.products) {
      const priced = lookupProduct(p.id);
      assert.ok(priced, p.id);
      assert.ok(Number.isSafeInteger(priced.unitPrice) && priced.unitPrice > 0, p.id);
    }
  });
  it("keeps the legacy prices", () => {
    assert.equal(lookupProduct("lace-black")?.unitPrice, egp(300));
    assert.equal(lookupProduct("bow-gold")?.unitPrice, egp(200));
    assert.equal(lookupProduct("classic-navy")?.unitPrice, egp(120));
  });
  it("governorate lists are aligned", () => {
    assert.equal(GOVERNORATES.length, GOVERNORATES_EN.length);
    assert.equal(GOVERNORATES.length, 27);
  });
});

describe("normalizeEgyptianMobile", () => {
  const cases: Array<[string, string | null]> = [
    ["01012345678", "01012345678"],
    ["010 1234 5678", "01012345678"],
    ["+201012345678", "01012345678"],
    ["00201012345678", "01012345678"],
    ["201012345678", "01012345678"],
    ["٠١٠١٢٣٤٥٦٧٨", "01012345678"],
    ["01512345678", "01512345678"],
    ["01312345678", null],
    ["0101234567", null],
    ["02012345678", null],
    ["abc", null],
    ["", null],
  ];
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      assert.equal(normalizeEgyptianMobile(input), expected);
    });
  }
});

describe("validateOrderRequest", () => {
  it("accepts a valid order and applies defaults", () => {
    const body: Record<string, unknown> = validBody();
    delete body["shippingMethod"];
    delete body["paymentMethod"];
    const r = validateOrderRequest(body, lookupProduct);
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.value.shippingMethod, "standard");
      assert.equal(r.value.paymentMethod, "cod");
    }
  });

  it("normalizes phone and accepts English governorate names", () => {
    const body = validBody();
    body.customer.phone = "+20 101 234 5678";
    body.customer.governorate = "giza";
    const r = validateOrderRequest(body, lookupProduct);
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.value.customer.phone, "01012345678");
      assert.equal(r.value.customer.governorate, "الجيزة");
    }
  });

  it("ignores any client-sent price or total", () => {
    const body = { ...validBody(), total: 1, items: [{ id: "lace-black", quantity: 1, price: 1, unitPrice: 1 }] };
    const r = validateOrderRequest(body, lookupProduct);
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.value.items, [{ id: "lace-black", quantity: 1 }]);
  });

  it("merges duplicate product ids", () => {
    const body = { ...validBody(), items: [{ id: "lace-black", quantity: 1 }, { id: "lace-black", quantity: 2 }] };
    const r = validateOrderRequest(body, lookupProduct);
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.value.items, [{ id: "lace-black", quantity: 3 }]);
  });

  it("collapses control characters and bidi overrides in text", () => {
    const body = validBody();
    body.customer.name = "منى\u0000‮  أحمد\n";
    const r = validateOrderRequest(body, lookupProduct);
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.value.customer.name, "منى أحمد");
  });

  const rejects: Array<[string, (b: ReturnType<typeof validBody>) => unknown, string, string]> = [
    ["empty cart", (b) => ({ ...b, items: [] }), "items", "empty_cart"],
    ["unknown product", (b) => ({ ...b, items: [{ id: "nope", quantity: 1 }] }), "items[0].id", "unknown_product"],
    ["zero quantity", (b) => ({ ...b, items: [{ id: "lace-black", quantity: 0 }] }), "items[0].quantity", "invalid_quantity"],
    ["fractional quantity", (b) => ({ ...b, items: [{ id: "lace-black", quantity: 1.5 }] }), "items[0].quantity", "invalid_quantity"],
    ["huge quantity", (b) => ({ ...b, items: [{ id: "lace-black", quantity: LIMITS.maxQuantityPerItem + 1 }] }), "items[0].quantity", "invalid_quantity"],
    ["string quantity", (b) => ({ ...b, items: [{ id: "lace-black", quantity: "2" }] }), "items[0].quantity", "invalid_quantity"],
    ["short name", (b) => ({ ...b, customer: { ...b.customer, name: "م" } }), "customer.name", "too_short"],
    ["missing name", (b) => ({ ...b, customer: { ...b.customer, name: "" } }), "customer.name", "required"],
    ["bad phone", (b) => ({ ...b, customer: { ...b.customer, phone: "123" } }), "customer.phone", "invalid_phone"],
    ["bad governorate", (b) => ({ ...b, customer: { ...b.customer, governorate: "Atlantis" } }), "customer.governorate", "invalid_governorate"],
    ["short address", (b) => ({ ...b, customer: { ...b.customer, address: "x" } }), "customer.address", "too_short"],
    ["long notes", (b) => ({ ...b, customer: { ...b.customer, notes: "x".repeat(301) } }), "customer.notes", "too_long"],
    ["bad shipping", (b) => ({ ...b, shippingMethod: "drone" }), "shippingMethod", "invalid_choice"],
    ["bad payment", (b) => ({ ...b, paymentMethod: "bitcoin" }), "paymentMethod", "invalid_choice"],
    ["non-object body", () => "hello", "body", "invalid_type"],
  ];
  for (const [label, mutate, path, code] of rejects) {
    it(`rejects ${label}`, () => {
      const r = validateOrderRequest(mutate(validBody()), lookupProduct);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.errors[path], code, JSON.stringify(r.errors));
    });
  }

  it("rejects a total quantity above the limit even when split across products", () => {
    const ids = catalog.products.slice(0, 5).map((p) => p.id);
    const items = ids.map((id) => ({ id, quantity: 11 }));
    const r = validateOrderRequest({ ...validBody(), items }, lookupProduct);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errors["items"], "too_many_items");
  });
});

describe("generateOrderId", () => {
  it("formats V-MMDD-XXXXX from UTC date and random bytes", () => {
    const id = generateOrderId(new Date("2026-10-09T10:00:00Z"), new Uint8Array([0, 1, 2, 31, 255]));
    assert.equal(id, "V-1009-234ZZ");
    assert.match(id, /^V-\d{4}-[2-9A-HJ-NP-Z]{5}$/);
  });
  it("needs enough randomness", () => {
    assert.throws(() => generateOrderId(new Date(), new Uint8Array(2)), RangeError);
  });
});

describe("buildOrder", () => {
  it("snapshots catalogue prices and computes totals with the shared pricing logic", () => {
    const body = { ...validBody(), items: [{ id: "bow-gold", quantity: 2 }, { id: "lace-black", quantity: 1 }] };
    const r = validateOrderRequest(body, lookupProduct);
    assert.ok(r.ok);
    if (!r.ok) return;
    const order = buildOrder(r.value, lookupProduct, SHIPPING, { id: "V-1009-AAAAA", now: new Date("2026-10-09T10:00:00Z") });
    // 300 (full) + 200 (25% = 50) + 200 (35% = 70)
    assert.equal(order.totals.subtotal, egp(700));
    assert.equal(order.totals.discount, egp(120));
    assert.equal(order.totals.net, egp(580));
    assert.equal(order.totals.shipping, egp(80));
    assert.equal(order.totals.total, egp(660));
    assert.equal(order.items[0]?.lineTotal, egp(400));
    assert.equal(order.createdAt, "2026-10-09T10:00:00.000Z");
    assert.equal(order.status, "new");
  });

  it("charges standard shipping below the threshold and express whenever chosen", () => {
    // 6 x 300 = 1800, discount 360, net 1440 (< 1500) => standard shipping is charged
    const six = { ...validBody(), items: [{ id: "lace-black", quantity: 6 }] };
    const r1 = validateOrderRequest(six, lookupProduct);
    assert.ok(r1.ok);
    if (r1.ok) {
      const o = buildOrder(r1.value, lookupProduct, SHIPPING, { id: "x", now: new Date() });
      assert.equal(o.totals.net, egp(1440));
      assert.equal(o.totals.shipping, SHIPPING.standard);
    }
    // 8 x 300 = 2400, discount (0+75+105)*2 + 0+75 = 435, net 1965 (>= 1500) => standard is free, express is not
    const eight = { ...validBody(), items: [{ id: "lace-black", quantity: 8 }] };
    const free = validateOrderRequest(eight, lookupProduct);
    const express = validateOrderRequest({ ...eight, shippingMethod: "express" }, lookupProduct);
    assert.ok(free.ok && express.ok);
    if (free.ok && express.ok) {
      const meta = { id: "y", now: new Date() };
      assert.equal(buildOrder(free.value, lookupProduct, SHIPPING, meta).totals.shipping, 0);
      assert.equal(buildOrder(express.value, lookupProduct, SHIPPING, meta).totals.shipping, SHIPPING.express);
    }
  });
});
