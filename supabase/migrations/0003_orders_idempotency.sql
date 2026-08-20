-- Phase 5: Add idempotency support to orders.
-- The Worker generates an idempotency key per checkout attempt. If the same
-- key is retried (double-click, network retry), the Worker returns the existing
-- order instead of creating a duplicate. Scoped per user.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
  ON orders(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
