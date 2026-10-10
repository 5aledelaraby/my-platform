import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateTotals, egp, formatEgp, shippingCost } from "../src/index.ts";
import type { ShippingConfig } from "../src/index.ts";

const shipping: ShippingConfig = { standard: egp(80), express: egp(120), freeOver: egp(1500) };

describe("money", () => {
  it("converts pounds to piasters and formats with Latin digits", () => {
    assert.equal(egp(120), 12000);
    assert.equal(egp(120.5), 12050);
    assert.equal(formatEgp(12000), "120");
    assert.equal(formatEgp(12050), "120.50");
    assert.equal(formatEgp(12005), "120.05");
  });

  it("rejects non-integer or negative piasters", () => {
    assert.throws(() => calculateTotals([{ unitPrice: 10.5, quantity: 1 }], "standard", shipping), RangeError);
    assert.throws(() => calculateTotals([{ unitPrice: -1, quantity: 1 }], "standard", shipping), RangeError);
    assert.throws(() => calculateTotals([{ unitPrice: 100, quantity: 1.5 }], "standard", shipping), RangeError);
  });
});

describe("shipping", () => {
  it("charges standard below the free threshold and nothing at or above it", () => {
    assert.equal(shippingCost(egp(1499), "standard", shipping), egp(80));
    assert.equal(shippingCost(egp(1500), "standard", shipping), 0);
  });

  it("always charges express", () => {
    assert.equal(shippingCost(egp(5000), "express", shipping), egp(120));
  });
});

describe("calculateTotals", () => {
  it("returns zeros for an empty cart (no shipping charged)", () => {
    assert.deepEqual(calculateTotals([], "standard", shipping), {
      itemCount: 0, subtotal: 0, discount: 0, net: 0, shipping: 0, total: 0,
    });
  });

  it("computes a three-belt order end to end (no quantity discount)", () => {
    const totals = calculateTotals([{ unitPrice: egp(200), quantity: 3 }], "standard", shipping);
    assert.equal(totals.subtotal, egp(600));
    assert.equal(totals.discount, 0);
    assert.equal(totals.net, egp(600));
    assert.equal(totals.shipping, egp(80));
    assert.equal(totals.total, egp(680));
  });

  it("applies the free-shipping threshold to the amount after a promo code", () => {
    // 6 x 300 = 1800, code 400 off, net 1400 < 1500 => shipping charged
    const totals = calculateTotals([{ unitPrice: egp(300), quantity: 6 }], "standard", shipping, egp(400));
    assert.equal(totals.net, egp(1400));
    assert.equal(totals.shipping, egp(80));
  });
});
