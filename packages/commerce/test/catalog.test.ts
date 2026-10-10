import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalog, lookupProduct, priceOf } from "../src/index.ts";

describe("catalog", () => {
  it("every product belongs to a known style and has a valid price", () => {
    const styleIds = new Set(catalog.styles.map((s) => s.id));
    for (const p of catalog.products) {
      assert.ok(styleIds.has(p.style), `${p.id} has unknown style ${p.style}`);
      assert.ok(Number.isInteger(priceOf(p)) && priceOf(p) > 0, `${p.id} has no price`);
      assert.equal(lookupProduct(p.id)?.unitPrice, priceOf(p));
    }
  });

  it("every product id starts with its design, so stock, orders and links read the same", () => {
    for (const p of catalog.products) assert.ok(p.id.startsWith(`${p.style}-`), p.id);
  });

  it("a product price overrides its style price", () => {
    // Croc and snake are the thin-tie design with a printed pattern, priced above the plain ones.
    assert.equal(lookupProduct("thin-tie-red")?.unitPrice, 12000);
    assert.equal(lookupProduct("thin-tie-croc-black")?.unitPrice, 20000);
    assert.equal(lookupProduct("thin-tie-snake-grey")?.unitPrice, 20000);
  });

  it("product names never say suede (every belt is PU leather)", () => {
    for (const p of catalog.products) assert.ok(!/suede|شمواه|شامواه/i.test(p.name), p.id);
  });
});
