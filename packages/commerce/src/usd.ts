import { assertPiasters } from "./money.ts";
import type { Piasters } from "./money.ts";

/**
 * PayPal does not take Egyptian pounds, so a PayPal order is charged in US dollars (ADR 0014). The owner sets a
 * fixed rate in the admin (owner, 2026-10-18): how many piasters one dollar costs, e.g. 5000 = 50 EGP per dollar.
 * Dollar amounts are integer cents, like piasters.
 */
export type UsdCents = number;

/** The rates the admin accepts: from 10 to 1000 EGP per dollar (a typo guard, not a market check). */
export const USD_RATE_LIMITS = { min: 1_000, max: 100_000 } as const;

export function isUsdRate(value: unknown): value is Piasters {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= USD_RATE_LIMITS.min && value <= USD_RATE_LIMITS.max;
}

/** The dollar amount for `amount` piasters at `rate` piasters per dollar, rounded up to the cent (never less). */
export function toUsdCents(amount: Piasters, rate: Piasters): UsdCents {
  assertPiasters(amount);
  if (!isUsdRate(rate)) throw new RangeError(`invalid USD rate ${String(rate)}`);
  return Math.ceil((amount * 100) / rate);
}

/** "12.34": always two decimals, as PayPal's API expects. */
export function formatUsd(cents: UsdCents): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError(`cents must be a non-negative integer, got ${String(cents)}`);
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Parses PayPal's "12.34" back into cents; null for anything else. */
export function parseUsd(value: unknown): UsdCents | null {
  if (typeof value !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
