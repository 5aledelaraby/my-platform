import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OFFERED_PAYMENT_METHODS, PAYMENT_METHODS, formatUsd, isUsdRate, lookupProduct, parseUsd, toUsdCents, validateOrderRequest } from "../src/index.ts";

describe("US dollars for PayPal", () => {
  it("offers cash on delivery and PayPal; InstaPay only stays readable on older orders", () => {
    assert.deepEqual([...OFFERED_PAYMENT_METHODS], ["cod", "paypal"]);
    assert.ok((PAYMENT_METHODS as readonly string[]).includes("instapay"));
    const order = (paymentMethod: string) =>
      validateOrderRequest(
        { items: [{ id: "lace-white", quantity: 1 }], customer: { name: "منى أحمد", phone: "01012345678", governorate: "القاهرة", address: "مدينة نصر، شارع عباس العقاد" }, paymentMethod },
        lookupProduct,
      );
    assert.equal(order("paypal").ok, true);
    assert.equal(order("cod").ok, true);
    const instapay = order("instapay");
    assert.equal(instapay.ok, false);
    assert.deepEqual(instapay.ok ? null : instapay.errors, { paymentMethod: "invalid_choice" });
  });

  it("converts piasters at the owner's rate, rounding up to the cent", () => {
    assert.equal(toUsdCents(100_000, 5_000), 2_000, "1000 EGP at 50 = $20.00");
    assert.equal(toUsdCents(66_000, 4_850), 1_361, "660 EGP at 48.50 = $13.608... -> $13.61");
    assert.equal(toUsdCents(0, 5_000), 0);
  });

  it("refuses rates outside 10 to 1000 EGP and non-integer amounts", () => {
    assert.equal(isUsdRate(5_000), true);
    for (const bad of [999, 100_001, 50.5, "5000", null, Number.NaN]) assert.equal(isUsdRate(bad), false, String(bad));
    assert.throws(() => toUsdCents(100, 0), RangeError);
    assert.throws(() => toUsdCents(1.5, 5_000), RangeError);
  });

  it("formats and parses PayPal's two-decimal strings", () => {
    assert.equal(formatUsd(1_361), "13.61");
    assert.equal(formatUsd(5), "0.05");
    assert.equal(formatUsd(2_000), "20.00");
    assert.equal(parseUsd("13.61"), 1_361);
    assert.equal(parseUsd("20"), 2_000);
    assert.equal(parseUsd("0.5"), 50);
    for (const bad of ["-1.00", "1.234", "abc", "", 12, null]) assert.equal(parseUsd(bad), null, String(bad));
  });
});
