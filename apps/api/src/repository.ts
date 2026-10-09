import type { Order } from "@platform/commerce";

export type InsertResult = "ok" | "conflict";

/** Where orders are stored. Two implementations: in-memory (tests) and Cloudflare D1 (production). */
export interface OrderRepository {
  /** Inserts the order and its items atomically. Returns "conflict" if the order id already exists. */
  insert(order: Order): Promise<InsertResult>;
}

export function memoryRepository(): OrderRepository & { orders: Map<string, Order> } {
  const orders = new Map<string, Order>();
  return {
    orders,
    insert(order) {
      if (orders.has(order.id)) return Promise.resolve("conflict");
      orders.set(order.id, structuredClone(order));
      return Promise.resolve("ok");
    },
  };
}

/** The slice of the Cloudflare D1 API this app uses. Keeps the app free of Workers type packages. */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
  /** D1 runs a batch as a single transaction. */
  batch(statements: D1Statement[]): Promise<unknown>;
}

const INSERT_ORDER = `INSERT INTO orders (
  id, created_at, status, customer_name, customer_phone, governorate, address, notes,
  shipping_method, payment_method, item_count, subtotal, discount, net, shipping, total
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** SQLite's message for a duplicate orders.id (D1 wraps it, e.g. "D1_ERROR: ...: SQLITE_CONSTRAINT"). */
const ORDER_ID_COLLISION = /UNIQUE constraint failed: orders\.id\b/;

function isOrderIdCollision(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Some D1 versions put the SQLite text on `cause` rather than on the message.
  const cause = (error as { cause?: unknown }).cause;
  return ORDER_ID_COLLISION.test(error.message) || (cause instanceof Error && ORDER_ID_COLLISION.test(cause.message));
}

const INSERT_ITEM = `INSERT INTO order_items (order_id, product_id, name, unit_price, quantity, line_total)
VALUES (?, ?, ?, ?, ?, ?)`;

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
          ),
        ...order.items.map((i) =>
          db.prepare(INSERT_ITEM).bind(order.id, i.productId, i.name, i.unitPrice, i.quantity, i.lineTotal),
        ),
      ];
      try {
        await db.batch(statements);
        return "ok";
      } catch (error) {
        // Only a duplicate order id is a retryable collision. Any other failure (CHECK, FOREIGN KEY,
        // NOT NULL, a duplicate item row) is a real data error and must surface as a server error.
        if (isOrderIdCollision(error)) return "conflict";
        throw error;
      }
    },
  };
}
