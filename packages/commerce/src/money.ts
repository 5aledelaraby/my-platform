/**
 * Money is always an integer number of piasters (1 EGP = 100 piasters).
 * Never store or compute prices as floating-point pounds.
 */
export type Piasters = number;

export const PIASTERS_PER_EGP = 100;

/** Convert a pounds amount (e.g. 120 or 120.5) to piasters. */
export function egp(pounds: number): Piasters {
  const piasters = Math.round(pounds * PIASTERS_PER_EGP);
  assertPiasters(piasters, "egp()");
  return piasters;
}

export function assertPiasters(value: number, label = "amount"): asserts value is Piasters {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer number of piasters, got ${String(value)}`);
  }
}

/** "120" for whole pounds, "120.50" otherwise. Latin digits, no currency symbol. */
export function formatEgp(amount: Piasters): string {
  assertPiasters(amount);
  const pounds = Math.trunc(amount / PIASTERS_PER_EGP);
  const rest = amount % PIASTERS_PER_EGP;
  return rest === 0 ? String(pounds) : `${pounds}.${String(rest).padStart(2, "0")}`;
}
