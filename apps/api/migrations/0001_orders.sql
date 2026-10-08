-- Orders and their line items. All money is integer piasters (ADR 0003).
-- Items keep a snapshot of name and price at creation time.
CREATE TABLE orders (
  id               TEXT PRIMARY KEY,
  created_at       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'new',
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  governorate      TEXT NOT NULL,
  address          TEXT NOT NULL,
  notes            TEXT,
  shipping_method  TEXT NOT NULL CHECK (shipping_method IN ('standard', 'express')),
  payment_method   TEXT NOT NULL CHECK (payment_method IN ('cod', 'instapay')),
  item_count       INTEGER NOT NULL CHECK (item_count > 0),
  subtotal         INTEGER NOT NULL CHECK (subtotal >= 0),
  discount         INTEGER NOT NULL CHECK (discount >= 0),
  net              INTEGER NOT NULL CHECK (net >= 0),
  shipping         INTEGER NOT NULL CHECK (shipping >= 0),
  total            INTEGER NOT NULL CHECK (total >= 0)
);

CREATE TABLE order_items (
  order_id    TEXT NOT NULL REFERENCES orders (id),
  product_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  unit_price  INTEGER NOT NULL CHECK (unit_price >= 0),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  line_total  INTEGER NOT NULL CHECK (line_total >= 0),
  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX idx_orders_created_at ON orders (created_at);
CREATE INDEX idx_orders_status ON orders (status);
