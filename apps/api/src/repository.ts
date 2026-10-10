import { ORDER_STATUSES } from "@platform/commerce";
import type { Order, OrderItem, OrderStatus, PaymentMethod, PromoCode, ShippingMethod } from "@platform/commerce";

/** "promo_used_up": the order's promo code reached its use limit (another order took the last use). */
export type InsertResult = "ok" | "conflict" | "out_of_stock" | "promo_used_up";
/** A new promo code as the admin creates it. */
export type NewPromo = Omit<PromoCode, "used" | "active">;
export interface StoredPromo extends PromoCode {
  createdAt: string;
}

const toPromo = (p: StoredPromo): PromoCode => ({
  code: p.code,
  amount: p.amount,
  minSubtotal: p.minSubtotal,
  maxUses: p.maxUses,
  used: p.used,
  expiresAt: p.expiresAt,
  active: p.active,
});
export type StatusResult = "ok" | "stale" | "not_found";
/** "stale": the stored quantity is no longer the one the owner saw (an order took units meanwhile). */
export type StockResult = { ok: true } | { ok: false; current: number | null };

/** An order as stored, with the fields the admin page needs to change it safely. */
export interface StoredOrder extends Order {
  /** Incremented on every status change; a change must name the version it was based on. */
  version: number;
  updatedAt: string | null;
}

export interface OrderSummary {
  id: string;
  createdAt: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  governorate: string;
  itemCount: number;
  total: number;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  version: number;
}

/** Where orders and stock live. Two implementations: in-memory (tests) and Cloudflare D1 (production). */
export interface OrderRepository {
  /**
   * Stores the order and its items and takes their units from tracked stock, all or nothing.
   * "conflict": the order id exists (retry with a new id). "out_of_stock": a tracked product would go below 0.
   */
  insert(order: Order): Promise<InsertResult>;
  /** Tracked products only: product id -> units on hand. */
  stock(): Promise<Map<string, number>>;
  /**
   * Sets a product's stock (or stops tracking it when `quantity` is null), but only if the stored value is still
   * `expected` (null = untracked). Otherwise nothing changes and the current value is returned.
   */
  setStock(productId: string, quantity: number | null, expected: number | null, now: string): Promise<StockResult>;
  /** Units taken from stock by orders that are not shipped, delivered or cancelled yet, per product. */
  reserved(): Promise<Map<string, number>>;
  /** True when the database has every table and column this code needs (migrations applied). */
  schemaReady(): Promise<boolean>;
  listOrders(options: { status?: OrderStatus; limit: number }): Promise<OrderSummary[]>;
  getOrder(id: string): Promise<StoredOrder | null>;
  /**
   * Moves the order from `from` to `to` only if it is still at `from` and `version` (another tab may have
   * changed it). Moving to "cancelled" returns the units this order took, in the same transaction, exactly once.
   * Does not check whether the move is allowed: the caller does (commerce `canTransition`).
   */
  setStatus(id: string, from: OrderStatus, to: OrderStatus, version: number, now: string, changeId: string): Promise<StatusResult>;
  /** Promo codes (ADR 0011). Codes are stored upper case. */
  getPromo(code: string): Promise<PromoCode | null>;
  listPromos(): Promise<StoredPromo[]>;
  /** "exists": a code with this name was created before (codes are never reused, so old orders stay clear). */
  createPromo(promo: NewPromo, now: string): Promise<"ok" | "exists">;
  /** false when there is no such code. */
  setPromoActive(code: string, active: boolean): Promise<boolean>;
}

// ---------------------------------------------------------------------------------------------
// In memory (tests)

interface MemoryState {
  orders: Map<string, StoredOrder>;
  promos: Map<string, StoredPromo>;
  inventory: Map<string, number>;
  /** order id -> product ids whose units were taken from stock. */
  taken: Map<string, Set<string>>;
}

export function memoryRepository(initialStock: Record<string, number> = {}): OrderRepository & MemoryState {
  const state: MemoryState = {
    orders: new Map(),
    promos: new Map(),
    inventory: new Map(Object.entries(initialStock)),
    taken: new Map(),
  };
  const summary = (o: StoredOrder): OrderSummary => ({
    id: o.id,
    createdAt: o.createdAt,
    status: o.status,
    customerName: o.customer.name,
    customerPhone: o.customer.phone,
    governorate: o.customer.governorate,
    itemCount: o.totals.itemCount,
    total: o.totals.total,
    shippingMethod: o.shippingMethod,
    paymentMethod: o.paymentMethod,
    version: o.version,
  });
  return {
    ...state,
    insert(order) {
      if (state.orders.has(order.id)) return Promise.resolve("conflict");
      for (const item of order.items) {
        const onHand = state.inventory.get(item.productId);
        if (onHand !== undefined && onHand < item.quantity) return Promise.resolve("out_of_stock");
      }
      const promo = order.promoCode ? state.promos.get(order.promoCode) : undefined;
      if (promo && promo.maxUses !== null && promo.used >= promo.maxUses) return Promise.resolve("promo_used_up");
      if (promo) promo.used += 1;
      const taken = new Set<string>();
      for (const item of order.items) {
        const onHand = state.inventory.get(item.productId);
        if (onHand !== undefined) {
          state.inventory.set(item.productId, onHand - item.quantity);
          taken.add(item.productId);
        }
      }
      state.taken.set(order.id, taken);
      state.orders.set(order.id, { ...structuredClone(order), version: 0, updatedAt: order.createdAt });
      return Promise.resolve("ok");
    },
    stock: () => Promise.resolve(new Map(state.inventory)),
    setStock(productId, quantity, expected) {
      const current = state.inventory.get(productId) ?? null;
      if (current !== expected) return Promise.resolve({ ok: false, current });
      if (quantity === null) state.inventory.delete(productId);
      else state.inventory.set(productId, quantity);
      return Promise.resolve({ ok: true });
    },
    reserved() {
      const out = new Map<string, number>();
      for (const o of state.orders.values()) {
        if (o.status !== "new" && o.status !== "confirmed") continue;
        for (const i of o.items) {
          if (state.taken.get(o.id)?.has(i.productId)) out.set(i.productId, (out.get(i.productId) ?? 0) + i.quantity);
        }
      }
      return Promise.resolve(out);
    },
    schemaReady: () => Promise.resolve(true),
    listOrders({ status, limit }) {
      const list = [...state.orders.values()]
        .filter((o) => status === undefined || o.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(summary);
      return Promise.resolve(list);
    },
    getOrder: (id) => Promise.resolve(state.orders.has(id) ? structuredClone(state.orders.get(id)!) : null),
    setStatus(id, from, to, version, now) {
      const o = state.orders.get(id);
      if (!o) return Promise.resolve("not_found");
      if (o.version !== version || o.status !== from) return Promise.resolve("stale");
      if (to === "cancelled" && o.status !== "cancelled") {
        for (const item of o.items) {
          const onHand = state.inventory.get(item.productId);
          if (state.taken.get(id)?.has(item.productId) && onHand !== undefined) {
            state.inventory.set(item.productId, onHand + item.quantity);
          }
        }
      }
      state.orders.set(id, { ...o, status: to, version: o.version + 1, updatedAt: now });
      return Promise.resolve("ok");
    },
    getPromo(code) {
      const p = state.promos.get(code);
      return Promise.resolve(p ? toPromo(p) : null);
    },
    listPromos: () => Promise.resolve([...state.promos.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => ({ ...p }))),
    createPromo(promo, now) {
      if (state.promos.has(promo.code)) return Promise.resolve("exists");
      state.promos.set(promo.code, { ...promo, used: 0, active: true, createdAt: now });
      return Promise.resolve("ok");
    },
    setPromoActive(code, active) {
      const p = state.promos.get(code);
      if (!p) return Promise.resolve(false);
      p.active = active;
      return Promise.resolve(true);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Cloudflare D1

/** The slice of the Cloudflare D1 API this app uses. Keeps the app free of Workers type packages. */
export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  meta?: { changes?: number };
}
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
  /** D1 runs a batch as a single transaction: any failing statement rolls back the whole batch. */
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}

const INSERT_ORDER = `INSERT INTO orders (
  id, created_at, status, customer_name, customer_phone, governorate, address, notes,
  shipping_method, payment_method, item_count, subtotal, discount, net, shipping, total, version, updated_at, promo_code
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`;

// One use of the order's promo code, in the same batch. Past the limit, CHECK promo_not_overused fails the order.
const USE_PROMO = `UPDATE promo_codes SET used = used + 1 WHERE code = ?`;

// stock_taken records whether the product was tracked at this moment, so a cancellation returns exactly that.
const INSERT_ITEM = `INSERT INTO order_items (order_id, product_id, name, unit_price, quantity, line_total, stock_taken)
VALUES (?, ?, ?, ?, ?, ?, EXISTS (SELECT 1 FROM inventory WHERE product_id = ?))`;

// No row (untracked product) -> no change. Below zero -> CHECK stock_not_negative fails the whole batch.
const TAKE_STOCK = `UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE product_id = ?`;

const SET_STATUS = `UPDATE orders SET status = ?, version = version + 1, updated_at = ?, change_id = ?
WHERE id = ? AND version = ? AND status = ?`;

// Runs in the same batch right after SET_STATUS. The change_id match means: only the request that really
// cancelled the order returns its units (a stale second cancel changes nothing, so it returns nothing).
const RETURN_STOCK = `UPDATE inventory
SET quantity = quantity + (
  SELECT oi.quantity FROM order_items oi
  WHERE oi.order_id = ? AND oi.product_id = inventory.product_id AND oi.stock_taken = 1
), updated_at = ?
WHERE product_id IN (SELECT product_id FROM order_items WHERE order_id = ? AND stock_taken = 1)
AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND change_id = ? AND status = 'cancelled')`;

/** SQLite's message for a duplicate orders.id (D1 wraps it, e.g. "D1_ERROR: ...: SQLITE_CONSTRAINT"). */
const ORDER_ID_COLLISION = /UNIQUE constraint failed: orders\.id\b/;
/** The named CHECK on inventory.quantity. */
const OUT_OF_STOCK = /CHECK constraint failed: stock_not_negative\b/;
/** The named CHECK on promo_codes.used. */
const PROMO_USED_UP = /CHECK constraint failed: promo_not_overused\b/;

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return "";
  // Some D1 versions put the SQLite text on `cause` rather than on the message.
  const cause = (error as { cause?: unknown }).cause;
  return `${error.message} ${cause instanceof Error ? cause.message : ""}`;
}

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  governorate: string;
  address: string;
  notes: string | null;
  shipping_method: string;
  payment_method: string;
  item_count: number;
  subtotal: number;
  discount: number;
  net: number;
  shipping: number;
  total: number;
  version: number;
  updated_at: string | null;
  promo_code: string | null;
}

interface PromoRow {
  code: string;
  amount: number;
  min_subtotal: number;
  max_uses: number | null;
  used: number;
  expires_at: string | null;
  active: number;
  created_at: string;
}

const promoFromRow = (r: PromoRow): StoredPromo => ({
  code: r.code,
  amount: r.amount,
  minSubtotal: r.min_subtotal,
  maxUses: r.max_uses,
  used: r.used,
  expiresAt: r.expires_at,
  active: r.active === 1,
  createdAt: r.created_at,
});

interface ItemRow {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

const asStatus = (v: string): OrderStatus => ((ORDER_STATUSES as readonly string[]).includes(v) ? (v as OrderStatus) : "new");

export function d1Repository(db: D1Like): OrderRepository {
  return {
    async insert(order) {
      const t = order.totals;
      const statements = [
        db
          .prepare(INSERT_ORDER)
          .bind(
            order.id, order.createdAt, order.status,
            order.customer.name, order.customer.phone, order.customer.governorate, order.customer.address,
            order.customer.notes ?? null,
            order.shippingMethod, order.paymentMethod,
            t.itemCount, t.subtotal, t.discount, t.net, t.shipping, t.total,
            order.createdAt, order.promoCode ?? null,
          ),
        ...order.items.map((i) =>
          db.prepare(INSERT_ITEM).bind(order.id, i.productId, i.name, i.unitPrice, i.quantity, i.lineTotal, i.productId),
        ),
        ...order.items.map((i) => db.prepare(TAKE_STOCK).bind(i.quantity, order.createdAt, i.productId)),
        ...(order.promoCode ? [db.prepare(USE_PROMO).bind(order.promoCode)] : []),
      ];
      try {
        await db.batch(statements);
        return "ok";
      } catch (error) {
        // Only a duplicate order id is a retryable collision, and only the stock CHECK means "sold out".
        // Any other failure (another CHECK, FOREIGN KEY, NOT NULL, a duplicate item row) is a real error.
        const text = errorText(error);
        if (ORDER_ID_COLLISION.test(text)) return "conflict";
        if (OUT_OF_STOCK.test(text)) return "out_of_stock";
        if (PROMO_USED_UP.test(text)) return "promo_used_up";
        throw error;
      }
    },

    async stock() {
      const { results = [] } = await db.prepare("SELECT product_id, quantity FROM inventory").all<{ product_id: string; quantity: number }>();
      return new Map(results.map((r) => [r.product_id, r.quantity]));
    },

    async setStock(productId, quantity, expected, now) {
      // Compare-and-set: change the row only if the stored value is still the one the owner saw (`expected`).
      const current = async () =>
        (await db.prepare("SELECT quantity FROM inventory WHERE product_id = ?").bind(productId).first<{ quantity: number }>())?.quantity ?? null;
      if (expected === null && quantity === null) {
        const stored = await current();
        return stored === null ? { ok: true } : { ok: false, current: stored };
      }
      const stmt =
        expected === null
          ? db.prepare("INSERT INTO inventory (product_id, quantity, updated_at) VALUES (?, ?, ?) ON CONFLICT (product_id) DO NOTHING").bind(productId, quantity, now)
          : quantity === null
            ? db.prepare("DELETE FROM inventory WHERE product_id = ? AND quantity = ?").bind(productId, expected)
            : db.prepare("UPDATE inventory SET quantity = ?, updated_at = ? WHERE product_id = ? AND quantity = ?").bind(quantity, now, productId, expected);
      const result = await stmt.run();
      if ((result.meta?.changes ?? 0) === 1) return { ok: true };
      return { ok: false, current: await current() };
    },

    async reserved() {
      const { results = [] } = await db
        .prepare(
          `SELECT oi.product_id AS product_id, SUM(oi.quantity) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE oi.stock_taken = 1 AND o.status IN ('new', 'confirmed') GROUP BY oi.product_id`,
        )
        .all<{ product_id: string; units: number }>();
      return new Map(results.map((r) => [r.product_id, Number(r.units)]));
    },

    async schemaReady() {
      try {
        await db.batch([
          db.prepare("SELECT version, updated_at, change_id FROM orders LIMIT 0"),
          db.prepare("SELECT stock_taken FROM order_items LIMIT 0"),
          db.prepare("SELECT product_id, quantity, updated_at FROM inventory LIMIT 0"),
          db.prepare("SELECT promo_code FROM orders LIMIT 0"),
          db.prepare("SELECT code, amount, min_subtotal, max_uses, used, expires_at, active, created_at FROM promo_codes LIMIT 0"),
        ]);
        return true;
      } catch {
        return false;
      }
    },

    async listOrders({ status, limit }) {
      const sql = `SELECT id, created_at, status, customer_name, customer_phone, governorate, item_count, total,
shipping_method, payment_method, version FROM orders ${status ? "WHERE status = ?" : ""} ORDER BY created_at DESC LIMIT ?`;
      const stmt = status ? db.prepare(sql).bind(status, limit) : db.prepare(sql).bind(limit);
      const { results = [] } = await stmt.all<OrderRow>();
      return results.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        status: asStatus(r.status),
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        governorate: r.governorate,
        itemCount: r.item_count,
        total: r.total,
        shippingMethod: r.shipping_method as ShippingMethod,
        paymentMethod: r.payment_method as PaymentMethod,
        version: r.version,
      }));
    },

    async getOrder(id) {
      const row = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
      if (!row) return null;
      const { results = [] } = await db
        .prepare("SELECT product_id, name, unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY rowid")
        .bind(id)
        .all<ItemRow>();
      const items: OrderItem[] = results.map((i) => ({
        productId: i.product_id,
        name: i.name,
        unitPrice: i.unit_price,
        quantity: i.quantity,
        lineTotal: i.line_total,
      }));
      return {
        id: row.id,
        createdAt: row.created_at,
        status: asStatus(row.status),
        customer: {
          name: row.customer_name,
          phone: row.customer_phone,
          governorate: row.governorate,
          address: row.address,
          ...(row.notes ? { notes: row.notes } : {}),
        },
        items,
        shippingMethod: row.shipping_method as ShippingMethod,
        paymentMethod: row.payment_method as PaymentMethod,
        ...(row.promo_code ? { promoCode: row.promo_code } : {}),
        totals: {
          itemCount: row.item_count,
          subtotal: row.subtotal,
          discount: row.discount,
          net: row.net,
          shipping: row.shipping,
          total: row.total,
        },
        version: row.version,
        updatedAt: row.updated_at,
      };
    },

    async setStatus(id, from, to, version, now, changeId) {
      const statements = [db.prepare(SET_STATUS).bind(to, now, changeId, id, version, from)];
      if (to === "cancelled") statements.push(db.prepare(RETURN_STOCK).bind(id, now, id, id, changeId));
      const results = await db.batch(statements);
      if ((results[0]?.meta?.changes ?? 0) === 1) return "ok";
      const exists = await db.prepare("SELECT 1 AS found FROM orders WHERE id = ?").bind(id).first();
      return exists ? "stale" : "not_found";
    },

    async getPromo(code) {
      const row = await db.prepare("SELECT * FROM promo_codes WHERE code = ?").bind(code).first<PromoRow>();
      return row ? toPromo(promoFromRow(row)) : null;
    },

    async listPromos() {
      const { results = [] } = await db.prepare("SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 1000").all<PromoRow>();
      return results.map(promoFromRow);
    },

    async createPromo(promo, now) {
      const result = await db
        .prepare(
          "INSERT INTO promo_codes (code, amount, min_subtotal, max_uses, used, expires_at, active, created_at) VALUES (?, ?, ?, ?, 0, ?, 1, ?) ON CONFLICT (code) DO NOTHING",
        )
        .bind(promo.code, promo.amount, promo.minSubtotal, promo.maxUses, promo.expiresAt, now)
        .run();
      return (result.meta?.changes ?? 0) === 1 ? "ok" : "exists";
    },

    async setPromoActive(code, active) {
      const result = await db.prepare("UPDATE promo_codes SET active = ? WHERE code = ?").bind(active ? 1 : 0, code).run();
      return (result.meta?.changes ?? 0) === 1;
    },
  };
}
