-- Inventory and order status changes. Each statement is on one line so it can be pasted into the D1 Console.
-- inventory: one row per TRACKED product. No row = untracked (always available). The named CHECK makes an
-- order that would push stock below zero fail as a whole (D1 runs the order batch as one transaction).
CREATE TABLE inventory (product_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CONSTRAINT stock_not_negative CHECK (quantity >= 0), updated_at TEXT NOT NULL);
-- version: optimistic lock for status changes (two tabs cannot cancel the same order twice).
ALTER TABLE orders ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN updated_at TEXT;
-- change_id: random id of the last status change. Stock is returned only by the request whose change_id is stored.
ALTER TABLE orders ADD COLUMN change_id TEXT;
-- stock_taken: 1 when this line took units from inventory, so a cancellation returns exactly those units.
ALTER TABLE order_items ADD COLUMN stock_taken INTEGER NOT NULL DEFAULT 0;
