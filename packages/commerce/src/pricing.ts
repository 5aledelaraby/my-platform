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

export function shippingCost(net: Piasters, method: ShippingMethod, config: ShippingConfig): Piasters {
  if (method === "express") return config.express;
  return net >= config.freeOver ? 0 : config.standard;
}

/**
 * Totals for a cart. `promoAmount` is a fixed discount from a promo code (see promo.ts); it never exceeds the
 * subtotal and never touches shipping. Free standard shipping is judged on the amount after the discount.
 */
export function calculateTotals(
  lines: readonly CartLine[],
  method: ShippingMethod,
  config: ShippingConfig,
  promoAmount: Piasters = 0,
): CartTotals {
  assertPiasters(promoAmount, "promoAmount");
  // Validate every line first, so invalid quantities can never cancel out into an "empty" cart.
  const units = expandUnits(lines);
  const itemCount = units.length;
  if (itemCount === 0) {
    return { itemCount: 0, subtotal: 0, discount: 0, net: 0, shipping: 0, total: 0 };
  }
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = Math.min(promoAmount, subtotal);
  const net = subtotal - discount;
  const shipping = shippingCost(net, method, config);
  return { itemCount, subtotal, discount, net, shipping, total: net + shipping };
}
