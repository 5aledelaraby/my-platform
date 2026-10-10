-- Promo codes (fixed amount off the belts), created by the owner in the admin page (ADR 0011).
-- One statement per line so the owner can paste them into the D1 console one by one.
CREATE TABLE promo_codes (code TEXT PRIMARY KEY, amount INTEGER NOT NULL CHECK (amount > 0), min_subtotal INTEGER NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0), max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0), used INTEGER NOT NULL DEFAULT 0, expires_at TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, CONSTRAINT promo_not_overused CHECK (max_uses IS NULL OR used <= max_uses));
ALTER TABLE orders ADD COLUMN promo_code TEXT;
