import { assertPiasters, type Piasters } from "./money.ts";

export interface CartLine {
  /** Price of ONE unit, in piasters. */
  unitPrice: Piasters;
  quantity: number;
}

export type ShippingMethod = "standard" | "express";

export interface ShippingConfig {
  standard: Piasters;
  express: Piasters;
  /** Standard shipping is free when the discounted subtotal reaches this amount. Express is never free. */
  freeOver: Piasters;
}

export interface CartTotals {
  itemCount: number;
  subtotal: Piasters;
  discount: Piasters;
  /** subtotal - discount */
  net: Piasters;
  shipping: Piasters;
  total: Piasters;
}

/**
 * Multi-belt offer, in basis points (10000 = 100%).
 * In every group of three units, sorted from dearest to cheapest:
 * the 1st is full price, the 2nd is 25% off, the 3rd is 35% off, then it repeats.
 * Integer basis points avoid floating-point drift.
 */
export const MULTI_ITEM_RATES_BPS = [0, 2500, 3500] as const;

function expandUnits(lines: readonly CartLine[]): Piasters[] {
  const units: Piasters[] = [];
  for (const line of lines) {
    assertPiasters(line.unitPrice, "unitPrice");
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 0) {
      throw new RangeError(`quantity must be a non-negative integer, got ${String(line.quantity)}`);
    }
    for (let i = 0; i < line.quantity; i++) units.push(line.unitPrice);
  }
  return units;
}

export function multiItemDiscount(lines: readonly CartLine[]): Piasters {
  const units = expandUnits(lines).sort((a, b) => b - a);
  let discount = 0;
  units.forEach((price, index) => {
    const rate = MULTI_ITEM_RATES_BPS[index % MULTI_ITEM_RATES_BPS.length] ?? 0;
    discount += Math.round((price * rate) / 10000);
  });
  return discount;
}

export function shippingCost(net: Piasters, method: ShippingMethod, config: ShippingConfig): Piasters {
  if (method === "express") return config.express;
  return net >= config.freeOver ? 0 : config.standard;
}

export function calculateTotals(
  lines: readonly CartLine[],
  method: ShippingMethod,
  config: ShippingConfig,
): CartTotals {
  const itemCount = lines.reduce((n, line) => n + line.quantity, 0);
  if (itemCount === 0) {
    return { itemCount: 0, subtotal: 0, discount: 0, net: 0, shipping: 0, total: 0 };
  }
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = multiItemDiscount(lines);
  const net = subtotal - discount;
  const shipping = shippingCost(net, method, config);
  return { itemCount, subtotal, discount, net, shipping, total: net + shipping };
}
