import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIMITS,
  ORDER_STATUSES,
  canTransition,
  isOrderStatus,
  nextStatuses,
  publicStock,
  remainingQuantity,
  stockShortages,
} from "../src/index.ts";

describe("order status rules", () => {
  it("moves forward one step at a time and can be cancelled until delivered", () => {
    assert.deepEqual(nextStatuses("new"), ["confirmed", "cancelled"]);
    assert.deepEqual(nextStatuses("confirmed"), ["shipped", "cancelled"]);
    assert.deepEqual(nextStatuses("shipped"), ["delivered", "cancelled"]);
    assert.ok(canTransition("new", "cancelled"));
    assert.ok(!canTransition("new", "delivered"));
    assert.ok(!canTransition("confirmed", "new"));
  });

  it("delivered and cancelled are final (no double cancel, no un-cancel)", () => {
    for (const to of ORDER_STATUSES) {
      assert.ok(!canTransition("cancelled", to), `cancelled -> ${to}`);
      assert.ok(!canTransition("delivered", to), `delivered -> ${to}`);
    }
  });

  it("recognises only known statuses", () => {
    assert.ok(isOrderStatus("shipped"));
    for (const v of ["Shipped", "", "returned", null, 1]) assert.ok(!isOrderStatus(v), String(v));
  });
});

describe("stockShortages", () => {
  const stock = new Map([["a", 2], ["b", 0]]);

  it("reports tracked products asked for beyond what is on hand", () => {
    assert.deepEqual(stockShortages([{ id: "a", quantity: 3 }, { id: "b", quantity: 1 }], stock), [
      { id: "a", requested: 3, available: 2 },
      { id: "b", requested: 1, available: 0 },
    ]);
  });

  it("accepts exactly the quantity on hand, and never limits untracked products", () => {
    assert.deepEqual(stockShortages([{ id: "a", quantity: 2 }, { id: "untracked", quantity: 20 }], stock), []);
  });

  it("adds up duplicate rows for the same product", () => {
    assert.deepEqual(stockShortages([{ id: "a", quantity: 1 }, { id: "a", quantity: 2 }], stock), [
      { id: "a", requested: 3, available: 2 },
    ]);
  });
});

describe("publicStock", () => {
  it("shows tracked products only, capped, never negative", () => {
    assert.deepEqual(publicStock(new Map([["a", 500], ["b", 3], ["c", 0], ["d", -1]]), 20), { a: 20, b: 3, c: 0, d: 0 });
  });
});

describe("remainingQuantity with stock", () => {
  it("is limited by stock for tracked products and by LIMITS otherwise", () => {
    const stock = new Map([["a", 3], ["b", 0]]);
    assert.equal(remainingQuantity([], "a", stock), 3);
    assert.equal(remainingQuantity([{ id: "a", quantity: 2 }], "a", stock), 1);
    assert.equal(remainingQuantity([{ id: "a", quantity: 3 }], "a", stock), 0);
    assert.equal(remainingQuantity([], "b", stock), 0);
    assert.equal(remainingQuantity([], "untracked", stock), LIMITS.maxQuantityPerItem);
  });

  it("never goes negative when a cart holds more than the stock left", () => {
    assert.equal(remainingQuantity([{ id: "a", quantity: 5 }], "a", new Map([["a", 2]])), 0);
  });
});
