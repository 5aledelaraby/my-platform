-- Pickup orders (owner, 2026-10-17): the customer collects the order from Vicuna, with no shipping fee and no address.
-- shipping_method keeps its original CHECK ('standard', 'express'); a pickup order stores 'standard' there and 1 here,
-- and the app reads it back as shippingMethod "pickup" (repository.ts). Existing orders get 0 (delivery).
-- One statement, safe to paste into the D1 console; it only adds a column.
ALTER TABLE orders ADD COLUMN pickup INTEGER NOT NULL DEFAULT 0 CHECK (pickup IN (0, 1));
