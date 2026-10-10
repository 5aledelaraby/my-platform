import type { PriceLookup } from "./catalog.ts";
import type { OrderStatus, StockLevels } from "./inventory.ts";
import type { Piasters } from "./money.ts";
import type { CartTotals, ShippingConfig, ShippingMethod } from "./pricing.ts";
import { calculateTotals } from "./pricing.ts";
import { normalizePromoCode } from "./promo.ts";
import { GOVERNORATES, GOVERNORATES_EN, PAYMENT_METHODS, SHIPPING_METHODS } from "./store.ts";

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const LIMITS = {
  maxDistinctItems: 30,
  maxQuantityPerItem: 20,
  maxTotalQuantity: 50,
  name: { min: 2, max: 80 },
  address: { min: 8, max: 300 },
  notes: { max: 300 },
} as const;

/**
 * How many more units of `id` a cart may take without breaking LIMITS (the same limits the API enforces)
 * or, when `stock` is given, the units on hand for tracked products.
 * 0 means no more of this product: a limit is reached or it is sold out.
 */
export function remainingQuantity(
  lines: ReadonlyArray<{ id: string; quantity: number }>,
  id: string,
  stock?: StockLevels,
): number {
  const current = lines.filter((l) => l.id === id).reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((n, l) => n + l.quantity, 0);
  const distinct = new Set(lines.filter((l) => l.quantity > 0).map((l) => l.id)).size;
  if (current === 0 && distinct >= LIMITS.maxDistinctItems) return 0;
  const onHand = stock?.get(id);
  const byStock = onHand === undefined ? Number.POSITIVE_INFINITY : onHand - current;
  return Math.max(0, Math.min(LIMITS.maxQuantityPerItem - current, LIMITS.maxTotalQuantity - total, byStock));
}

/** A request that passed validation. Contains NO prices: prices come from the catalogue. */
export interface ValidOrderRequest {
  items: Array<{ id: string; quantity: number }>;
  customer: { name: string; phone: string; governorate: string; address: string; notes?: string };
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  /** Normalized promo code the customer typed (format checked only; the API checks it exists and applies). */
  promoCode?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  unitPrice: Piasters;
  quantity: number;
  lineTotal: Piasters;
}

/** Orders keep a snapshot of names, prices and totals as of creation time. */
export interface Order {
  id: string;
  /** ISO 8601 UTC. */
  createdAt: string;
  /** Always "new" when created; the owner moves it on from the admin page. */
  status: OrderStatus;
  customer: ValidOrderRequest["customer"];
  items: OrderItem[];
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  /** The promo code applied; `totals.discount` is its amount. Absent when no code was used. */
  promoCode?: string;
  totals: CartTotals;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

/** Error values are stable codes; the UI translates them. */
export type ErrorCode =
  | "required" | "invalid_type" | "too_short" | "too_long"
  | "invalid_phone" | "invalid_governorate" | "invalid_choice"
  | "unknown_product" | "invalid_quantity" | "too_many_items" | "empty_cart" | "invalid_promo";

// Control characters, zero-width space, bidi overrides/isolates and BOM. Escapes are written as string
// escapes so no invisible character ever sits in this source file.
const UNSAFE = new RegExp("[\\u0000-\\u001F\\u007F\\u200B\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]", "g");

function clean(value: string): string {
  return value.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
}

/** Arabic-Indic and Persian digits to Latin. */
function latinDigits(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code >= 0x660 && code <= 0x669) out += String(code - 0x660);
    else if (code >= 0x6f0 && code <= 0x6f9) out += String(code - 0x6f0);
    else out += ch;
  }
  return out;
}

/** Returns an Egyptian mobile as "01xxxxxxxxx", or null if it is not one. Accepts +20 / 0020 / 20 prefixes. */
export function normalizeEgyptianMobile(input: string): string | null {
  let s = latinDigits(input).replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0020")) s = s.slice(2);
  if (s.startsWith("20") && s.length === 12) s = `0${s.slice(2)}`;
  return /^01[0125]\d{8}$/.test(s) ? s : null;
}

function resolveGovernorate(input: string): string | null {
  const wanted = clean(input);
  const arabic = (GOVERNORATES as readonly string[]).find((g) => g === wanted);
  if (arabic) return arabic;
  const index = GOVERNORATES_EN.findIndex((g) => g.toLowerCase() === wanted.toLowerCase());
  return index >= 0 ? (GOVERNORATES[index] ?? null) : null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function text(
  source: Record<string, unknown>,
  key: string,
  path: string,
  errors: Record<string, string>,
  opts: { min?: number; max: number; optional?: boolean },
): string | undefined {
  const raw = source[key];
  if (raw === undefined || raw === null || raw === "") {
    if (!opts.optional) errors[path] = "required" satisfies ErrorCode;
    return undefined;
  }
  if (typeof raw !== "string") {
    errors[path] = "invalid_type" satisfies ErrorCode;
    return undefined;
  }
  const value = clean(raw);
  if (value === "") {
    if (!opts.optional) errors[path] = "required" satisfies ErrorCode;
    return undefined;
  }
  if (opts.min !== undefined && value.length < opts.min) errors[path] = "too_short" satisfies ErrorCode;
  else if (value.length > opts.max) errors[path] = "too_long" satisfies ErrorCode;
  else return value;
  return undefined;
}

/**
 * Validates untrusted input. Unknown fields (including any client-sent price) are ignored.
 * Duplicate product ids are merged.
 */
export function validateOrderRequest(input: unknown, lookup: PriceLookup): ValidationResult<ValidOrderRequest> {
  const errors: Record<string, string> = {};
  if (!isRecord(input)) return { ok: false, errors: { body: "invalid_type" satisfies ErrorCode } };

  // items
  const merged = new Map<string, number>();
  const rawItems = input["items"];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    errors["items"] = "empty_cart" satisfies ErrorCode;
  } else if (rawItems.length > LIMITS.maxDistinctItems) {
    errors["items"] = "too_many_items" satisfies ErrorCode;
  } else {
    rawItems.forEach((item, i) => {
      if (!isRecord(item) || typeof item["id"] !== "string") {
        errors[`items[${i}].id`] = "invalid_type" satisfies ErrorCode;
        return;
      }
      const id = item["id"];
      if (!lookup(id)) errors[`items[${i}].id`] = "unknown_product" satisfies ErrorCode;
      const q = item["quantity"];
      if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > LIMITS.maxQuantityPerItem) {
        errors[`items[${i}].quantity`] = "invalid_quantity" satisfies ErrorCode;
        return;
      }
      merged.set(id, (merged.get(id) ?? 0) + q);
    });
    const total = [...merged.values()].reduce((a, b) => a + b, 0);
    if (total > LIMITS.maxTotalQuantity || [...merged.values()].some((n) => n > LIMITS.maxQuantityPerItem)) {
      errors["items"] = "too_many_items" satisfies ErrorCode;
    }
  }

  // customer
  const customerRaw = input["customer"];
  const c = isRecord(customerRaw) ? customerRaw : {};
  if (!isRecord(customerRaw)) errors["customer"] = "required" satisfies ErrorCode;

  const name = text(c, "name", "customer.name", errors, LIMITS.name);
  const address = text(c, "address", "customer.address", errors, LIMITS.address);
  const notes = text(c, "notes", "customer.notes", errors, { ...LIMITS.notes, optional: true });

  let phone: string | undefined;
  const phoneRaw = c["phone"];
  if (phoneRaw === undefined || phoneRaw === null || phoneRaw === "") errors["customer.phone"] = "required" satisfies ErrorCode;
  else if (typeof phoneRaw !== "string") errors["customer.phone"] = "invalid_type" satisfies ErrorCode;
  else {
    phone = normalizeEgyptianMobile(phoneRaw) ?? undefined;
    if (!phone) errors["customer.phone"] = "invalid_phone" satisfies ErrorCode;
  }

  let governorate: string | undefined;
  const govRaw = c["governorate"];
  if (govRaw === undefined || govRaw === null || govRaw === "") errors["customer.governorate"] = "required" satisfies ErrorCode;
  else if (typeof govRaw !== "string") errors["customer.governorate"] = "invalid_type" satisfies ErrorCode;
  else {
    governorate = resolveGovernorate(govRaw) ?? undefined;
    if (!governorate) errors["customer.governorate"] = "invalid_governorate" satisfies ErrorCode;
  }

  // choices (default to the common option when omitted)
  const shippingMethod = input["shippingMethod"] ?? "standard";
  if (!(SHIPPING_METHODS as readonly unknown[]).includes(shippingMethod)) errors["shippingMethod"] = "invalid_choice" satisfies ErrorCode;
  const paymentMethod = input["paymentMethod"] ?? "cod";
  if (!(PAYMENT_METHODS as readonly unknown[]).includes(paymentMethod)) errors["paymentMethod"] = "invalid_choice" satisfies ErrorCode;

  // optional promo code (format only here)
  let promoCode: string | undefined;
  const promoRaw = input["promoCode"];
  if (promoRaw !== undefined && promoRaw !== null && promoRaw !== "") {
    promoCode = normalizePromoCode(promoRaw) ?? undefined;
    if (!promoCode) errors["promoCode"] = "invalid_promo" satisfies ErrorCode;
  }

  if (Object.keys(errors).length > 0 || !name || !address || !phone || !governorate) return { ok: false, errors };

  return {
    ok: true,
    value: {
      items: [...merged].map(([id, quantity]) => ({ id, quantity })),
      customer: { name, phone, governorate, address, ...(notes ? { notes } : {}) },
      shippingMethod: shippingMethod as ShippingMethod,
      paymentMethod: paymentMethod as PaymentMethod,
      ...(promoCode ? { promoCode } : {}),
    },
  };
}

const ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 symbols, no 0/O/1/I

/** Human-friendly order number like "V-1009-7K3PQ" (UTC month-day + 5 random symbols). */
export function generateOrderId(now: Date, randomBytes: Uint8Array): string {
  if (randomBytes.length < 5) throw new RangeError("need at least 5 random bytes");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += ID_ALPHABET[(randomBytes[i] ?? 0) & 31];
  return `V-${mm}${dd}-${suffix}`;
}

/** Builds the order with prices taken from the catalogue, never from the client. */
export function buildOrder(
  request: ValidOrderRequest,
  lookup: PriceLookup,
  shipping: ShippingConfig,
  meta: { id: string; now: Date; promo?: { code: string; amount: Piasters } },
): Order {
  const items: OrderItem[] = request.items.map(({ id, quantity }) => {
    const product = lookup(id);
    if (!product) throw new Error(`unknown product ${id}`);
    return { productId: id, name: product.name, unitPrice: product.unitPrice, quantity, lineTotal: product.unitPrice * quantity };
  });
  const totals = calculateTotals(
    items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity })),
    request.shippingMethod,
    shipping,
    meta.promo?.amount ?? 0,
  );
  return {
    id: meta.id,
    createdAt: meta.now.toISOString(),
    status: "new",
    customer: request.customer,
    items,
    shippingMethod: request.shippingMethod,
    paymentMethod: request.paymentMethod,
    ...(meta.promo ? { promoCode: meta.promo.code } : {}),
    totals,
  };
}
