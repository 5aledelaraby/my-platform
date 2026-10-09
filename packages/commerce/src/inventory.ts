/**
 * Stock and order-status rules. Pure functions; storage lives in apps/api.
 *
 * Stock is tracked per product only when the owner sets a quantity. A product with no stock entry is
 * "untracked" and always available (the behaviour before inventory existed).
 */

/** Tracked products only: product id -> units on hand (never negative). */
export type StockLevels = ReadonlyMap<string, number>;

export const ORDER_STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  // A shipped order can still come back (refused at the door or returned): cancelling puts the stock back.
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** The statuses an order may move to from `from`. Cancelled and delivered are final. */
export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return NEXT[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

export interface StockShortage {
  id: string;
  requested: number;
  available: number;
}

/** Items asking for more than the tracked stock. Untracked products never fall short. */
export function stockShortages(items: ReadonlyArray<{ id: string; quantity: number }>, stock: StockLevels): StockShortage[] {
  const wanted = new Map<string, number>();
  for (const item of items) wanted.set(item.id, (wanted.get(item.id) ?? 0) + item.quantity);
  const shortages: StockShortage[] = [];
  for (const [id, requested] of wanted) {
    const available = stock.get(id);
    if (available !== undefined && requested > available) shortages.push({ id, requested, available });
  }
  return shortages;
}

/**
 * What the public may see: tracked products only, capped so the real quantity on hand is not disclosed
 * beyond what a single order could use.
 */
export function publicStock(stock: StockLevels, cap: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, quantity] of stock) out[id] = Math.max(0, Math.min(quantity, cap));
  return out;
}
