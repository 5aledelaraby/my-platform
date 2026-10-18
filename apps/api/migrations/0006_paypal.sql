-- PayPal (owner, 2026-10-18, ADR 0014): the customer pays online in US dollars after placing the order.
-- payment_method keeps its original CHECK ('cod', 'instapay'): SQLite cannot change a CHECK in place. A PayPal order
-- stores 'instapay' there (paid in advance, never cash on delivery) with paypal = 1, and the app reads it back as
-- paymentMethod "paypal" (repository.ts), like pickup in 0005. Existing orders get 0.
-- paypal_order_id / paypal_usd_cents: the PayPal order made for it and its dollar amount (cents), set when the
-- customer opens PayPal; paypal_capture_id / paid_at: set once PayPal confirms the money was taken.
-- settings: owner settings by name; 'usd_rate' = piasters per US dollar, set in the admin.
-- Safe to paste into the D1 console as it is (one command per line): it only adds columns and one table.
ALTER TABLE orders ADD COLUMN paypal INTEGER NOT NULL DEFAULT 0 CHECK (paypal IN (0, 1));
ALTER TABLE orders ADD COLUMN paypal_order_id TEXT;
ALTER TABLE orders ADD COLUMN paypal_usd_cents INTEGER CHECK (paypal_usd_cents IS NULL OR paypal_usd_cents > 0);
ALTER TABLE orders ADD COLUMN paypal_capture_id TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
