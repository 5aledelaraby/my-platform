import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateTotals, egp, formatEgp, multiItemDiscount, shippingCost } from "../src/index.ts";
import type { ShippingConfig } from "../src/index.ts";

const shipping: ShippingConfig = { standard: egp(80), express: egp(120), freeOver: egp(1500) };

/** The discount function of the legacy site (vicuna-eg.com, src/client/app.ts), in whole pounds. */
function legacyDiscount(prices: number[]): number {
  const RATES = [0, 0.25, 0.35];
  return [...prices].sort((a, b) => b - a).reduce((d, price, i) => d + Math.round(price * (RATES[i % 3] ?? 0)), 0);
}

describe("money", () => {
  it("converts pounds to piasters and formats with Latin digits", () => {
    assert.equal(egp(120), 12000);
    assert.equal(egp(120.5), 12050);
    assert.equal(formatEgp(12000), "120");
    assert.equal(formatEgp(12050), "120.50");
    assert.equal(formatEgp(12005), "120.05");
  });

  it("rejects non-integer or negative piasters", () => {
    assert.throws(() => multiItemDiscount([{ unitPrice: 10.5, quantity: 1 }]), RangeError);
    assert.throws(() => multiItemDiscount([{ unitPrice: -1, quantity: 1 }]), RangeError);
    assert.throws(() => multiItemDiscount([{ unitPrice: 100, quantity: 1.5 }]), RangeError);
  });
});

describe("multi-item discount", () => {
  it("gives nothing for a single belt", () => {
    assert.equal(multiItemDiscount([{ unitPrice: egp(200), quantity: 1 }]), 0);
  });

  it("takes 25% off the 2nd and 35% off the 3rd, then repeats", () => {
    const line = { unitPrice: egp(200), quantity: 1 };
    assert.equal(multiItemDiscount([{ ...line, quantity: 2 }]), egp(50));
    assert.equal(multiItemDiscount([{ ...line, quantity: 3 }]), egp(50 + 70));
    assert.equal(multiItemDiscount([{ ...line, quantity: 4 }]), egp(50 + 70));
    assert.equal(multiItemDiscount([{ ...line, quantity: 5 }]), egp(50 + 70 + 50));
    assert.equal(multiItemDiscount([{ ...line, quantity: 6 }]), egp(50 + 70 + 50 + 70));
  });

  it("lands the discounts on the cheaper belts", () => {
    // 300 (full), 200 (25% = 50), 120 (35% = 42)
    const lines = [
      { unitPrice: egp(120), quantity: 1 },
      { unitPrice: egp(300), quantity: 1 },
      { unitPrice: egp(200), quantity: 1 },
    ];
    assert.equal(multiItemDiscount(lines), egp(50 + 42));
  });

  it("matches the legacy site for every combination of the current catalogue prices", () => {
    const catalogue = [120, 200, 300];
    for (let a = 0; a <= 4; a++) {
      for (let b = 0; b <= 4; b++) {
        for (let c = 0; c <= 4; c++) {
          const counts = [a, b, c];
          const prices = catalogue.flatMap((p, i) => Array<number>(counts[i] ?? 0).fill(p));
          const lines = catalogue.map((p, i) => ({ unitPrice: egp(p), quantity: counts[i] ?? 0 }));
          assert.equal(multiItemDiscount(lines), egp(legacyDiscount(prices)), `counts=${counts.join(",")}`);
        }
      }
    }
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

  it("computes a three-belt order end to end", () => {
    const totals = calculateTotals([{ unitPrice: egp(200), quantity: 3 }], "standard", shipping);
    assert.equal(totals.subtotal, egp(600));
    assert.equal(totals.discount, egp(120));
    assert.equal(totals.net, egp(480));
    assert.equal(totals.shipping, egp(80));
    assert.equal(totals.total, egp(560));
  });

  it("applies the free-shipping threshold to the discounted amount", () => {
    // 6 x 300 = 1800, discount (0 + 75 + 105) * 2 = 360, net 1440 < 1500 => shipping charged
    const totals = calculateTotals([{ unitPrice: egp(300), quantity: 6 }], "standard", shipping);
    assert.equal(totals.net, egp(1440));
    assert.equal(totals.shipping, egp(80));
  });
});
