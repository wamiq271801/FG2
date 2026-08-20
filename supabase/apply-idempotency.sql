-- Phase 5: Add idempotency support to orders.
-- Run this in the Supabase Dashboard SQL Editor.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
  ON orders(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
