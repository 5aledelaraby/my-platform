// Promo codes: a fixed amount off the belts (never off shipping). The owner creates them in the admin page;
// the order API is the authority (it re-checks the code when the order is stored). The cart only previews.
import { assertPiasters } from "./money.ts";
import type { Piasters } from "./money.ts";

/** Codes are stored and compared in upper case: letters A-Z and digits, 3 to 20 characters. */
export const PROMO_CODE_PATTERN = /^[A-Z0-9]{3,20}$/;

export interface PromoCode {
  code: string;
  /** Fixed discount in piasters. */
  amount: Piasters;
  /** The belts subtotal must be at least this much for the code to apply (0 = no minimum). */
  minSubtotal: Piasters;
  /** null = unlimited. */
  maxUses: number | null;
  used: number;
  /** ISO 8601 UTC, exclusive; null = never expires. */
  expiresAt: string | null;
  active: boolean;
}

/** Why a code cannot be used. Stable codes; the UI translates them. */
export type PromoProblem = "invalid_promo" | "promo_inactive" | "promo_expired" | "promo_used_up" | "promo_min_subtotal";

// Spaces, control characters, zero-width and bidi marks that a copy from WhatsApp may carry. Written as string
// escapes so no invisible character sits in this file.
const INVISIBLE = new RegExp("[\\s\\u0000-\\u001F\\u007F\\u061C\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]", "g");

/**
 * Removes spaces and invisible marks, turns Arabic-Indic and Persian digits into Latin ones, and upper-cases ASCII
 * letters. Returns null if the result is not a valid code.
 */
export function normalizePromoCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let code = "";
  for (const ch of input.replace(INVISIBLE, "")) {
    const n = ch.charCodeAt(0);
    if (n >= 0x660 && n <= 0x669) code += String(n - 0x660);
    else if (n >= 0x6f0 && n <= 0x6f9) code += String(n - 0x6f0);
    else if (ch >= "a" && ch <= "z") code += ch.toUpperCase();
    else code += ch;
  }
  return PROMO_CODE_PATTERN.test(code) ? code : null;
}

/** null when the code applies to a belts subtotal of `subtotal` at `now`. */
export function promoProblem(promo: PromoCode | null, subtotal: Piasters, now: Date): PromoProblem | null {
  if (!promo) return "invalid_promo";
  if (!promo.active) return "promo_inactive";
  // An unreadable date counts as expired (fail closed).
  if (promo.expiresAt !== null && !(Date.parse(promo.expiresAt) > now.getTime())) return "promo_expired";
  if (promo.maxUses !== null && promo.used >= promo.maxUses) return "promo_used_up";
  if (subtotal < promo.minSubtotal) return "promo_min_subtotal";
  return null;
}

/** The discount a code gives on a belts subtotal: its amount when the minimum is reached, otherwise 0. */
export function promoAmountFor(promo: Pick<PromoCode, "amount" | "minSubtotal">, subtotal: Piasters): Piasters {
  return subtotal >= promo.minSubtotal ? Math.min(promo.amount, subtotal) : 0;
}

export interface NewPromoInput {
  code: unknown;
  amount: unknown;
  minSubtotal?: unknown;
  maxUses?: unknown;
  expiresAt?: unknown;
}

/** Highest fixed discount the admin may set: 1,000 EGP (a guard against a typo such as 5000 for 50). */
export const MAX_PROMO_AMOUNT: Piasters = 100_000;

/**
 * Validates a new code from the admin. Amounts arrive in piasters. Returns the stored shape or field errors.
 */
export function validateNewPromo(
  input: NewPromoInput,
  now: Date,
): { ok: true; value: Omit<PromoCode, "used" | "active"> } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const code = normalizePromoCode(input.code);
  if (!code) errors["code"] = "invalid_promo";
  const amount = input.amount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_PROMO_AMOUNT) errors["amount"] = "invalid_amount";
  const min = input.minSubtotal ?? 0;
  if (typeof min !== "number" || !Number.isSafeInteger(min) || min < 0 || min > 100 * MAX_PROMO_AMOUNT) errors["minSubtotal"] = "invalid_amount";
  const maxUses = input.maxUses ?? null;
  if (maxUses !== null && (typeof maxUses !== "number" || !Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000)) errors["maxUses"] = "invalid_number";
  let expiresAt: string | null = null;
  const rawExpiry = input.expiresAt ?? null;
  if (rawExpiry !== null) {
    const t = typeof rawExpiry === "string" ? Date.parse(rawExpiry) : Number.NaN;
    if (Number.isNaN(t) || t <= now.getTime()) errors["expiresAt"] = "invalid_date";
    else expiresAt = new Date(t).toISOString();
  }
  if (Object.keys(errors).length > 0 || !code) return { ok: false, errors };
  assertPiasters(amount as number);
  return {
    ok: true,
    value: { code, amount: amount as Piasters, minSubtotal: min as Piasters, maxUses: maxUses as number | null, expiresAt },
  };
}
