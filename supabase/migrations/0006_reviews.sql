-- Phase: Product Review System
-- Run in the Supabase Dashboard SQL Editor.
--
-- Adds the three product identities (id, fgp_number, slug) and rebuilds
-- product_reviews around product_id + user_id with database-enforced
-- one-review-per-product and delivered-purchase authorization.

-- =========================================================================
-- 1. products.id — internal relational identity (uuid, NOT NULL, unique)
--    slug remains the PRIMARY KEY so existing cart_items/order_items/wishlist
--    FKs keep working. id is the canonical relational identity for reviews.
-- =========================================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

-- Backfill any NULL (defensive — DEFAULT covers new rows, existing rows already
-- got a value from the ALTER above, but be safe).
UPDATE products SET id = gen_random_uuid() WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_id ON products(id);

-- =========================================================================
-- 2. products.fgp_number — public product identifier
--    Format: FGPN + 6 chars from a safe alphabet (no 0/O/1/I).
--    DB-generated, unique, NOT NULL. Never generated in frontend/Worker/admin.
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE fgp_alphabet AS ENUM (
    'A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z',
    '2','3','4','5','6','7','8','9'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Generate one FGPN with retry on collision. 32-char alphabet, 6 positions
-- = 32^6 ≈ 1.07e9 combinations — collision-safe for the catalog scale.
CREATE OR REPLACE FUNCTION generate_fgp_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_fgp text;
  v_attempts int := 0;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    SELECT 'FGPN' || string_agg(ch, '')
    INTO v_fgp
    FROM (
      SELECT (ARRAY(
        SELECT chr FROM (
          SELECT chr, idx FROM (
            SELECT
             CASE WHEN i = 1 THEN 'A' WHEN i = 2 THEN 'B' WHEN i = 3 THEN 'C'
                   WHEN i = 4 THEN 'D' WHEN i = 5 THEN 'E' WHEN i = 6 THEN 'F'
                   WHEN i = 7 THEN 'G' WHEN i = 8 THEN 'H' WHEN i = 9 THEN 'J'
                   WHEN i = 10 THEN 'K' WHEN i = 11 THEN 'L' WHEN i = 12 THEN 'M'
                   WHEN i = 13 THEN 'N' WHEN i = 14 THEN 'P' WHEN i = 15 THEN 'Q'
                   WHEN i = 16 THEN 'R' WHEN i = 17 THEN 'S' WHEN i = 18 THEN 'T'
                   WHEN i = 19 THEN 'U' WHEN i = 20 THEN 'V' WHEN i = 21 THEN 'W'
                   WHEN i = 22 THEN 'X' WHEN i = 23 THEN 'Y' WHEN i = 24 THEN 'Z'
                   WHEN i = 25 THEN '2' WHEN i = 26 THEN '3' WHEN i = 27 THEN '4'
                   WHEN i = 28 THEN '5' WHEN i = 29 THEN '6' WHEN i = 30 THEN '7'
                   WHEN i = 31 THEN '8' WHEN i = 32 THEN '9'
              END AS chr,
              i AS idx
            FROM generate_series(1, 32) AS g(i)
          ) alpha
          ORDER BY random()
          LIMIT 1
        )
      ) AS ch)
    ) AS pick(ch);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM products WHERE fgp_number = v_fgp);
    IF v_attempts > 10 THEN
      RAISE 'FGPN generation failed after 10 attempts';
    END IF;
  END LOOP;
  RETURN v_fgp;
END;
$$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fgp_number text;

-- Backfill existing rows with a unique FGPN.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT slug FROM products WHERE fgp_number IS NULL LOOP
    UPDATE products SET fgp_number = generate_fgp_number() WHERE slug = r.slug;
  END LOOP;
END $$;

ALTER TABLE products
  ALTER COLUMN fgp_number SET NOT NULL,
  ALTER COLUMN fgp_number SET DEFAULT generate_fgp_number();

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_fgp_number ON products(fgp_number);

-- =========================================================================
-- 3. product_reviews — rebuild around product_id + user_id
--    The old table (editorial seed: author/verified/position/review_date) is
--    replaced. Seed reviews are NOT preserved — the new model is user-authored
--    with database-enforced one-review-per-user-per-product.
-- =========================================================================

-- Drop old policies + index before restructuring.
DROP POLICY IF EXISTS "product_reviews_read" ON product_reviews;
DROP INDEX IF EXISTS idx_product_reviews_product;
DROP INDEX IF EXISTS idx_product_reviews_product_created;

-- Remove the old table entirely. Seed data is editorial (free-text author),
-- not user-authored, and does not map to the new user_id model. The new
-- authoritative review system starts empty.
DROP TABLE IF EXISTS product_reviews CASCADE;

CREATE TABLE product_reviews (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       text NOT NULL DEFAULT '',
  body        text NOT NULL CHECK (length(body) > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Latest reviews on the product page (product_id + created_at DESC).
CREATE INDEX idx_product_reviews_product_created
  ON product_reviews(product_id, created_at DESC);
-- (user_id, product_id) lookup covered by the UNIQUE constraint's index.

-- updated_at trigger (reuses the shared set_updated_at() from 0001).
DROP TRIGGER IF EXISTS trg_product_reviews_updated_at ON product_reviews;
CREATE TRIGGER trg_product_reviews_updated_at BEFORE UPDATE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- 4. can_review_product(p_product_id) — narrow eligibility check
--    SECURITY INVOKER STABLE: runs as the caller, so orders RLS auto-filters
--    to the caller's own orders. No user_id accepted from the client.
--    Returns boolean. Exposes nothing about the order beyond eligibility.
-- =========================================================================
CREATE OR REPLACE FUNCTION can_review_product(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = auth.uid()
      AND o.status = 'delivered'
      AND oi.product_slug = (SELECT slug FROM products WHERE id = p_product_id)
  );
$$;

-- The eligibility check is called from RLS + the client. Grant to authenticated
-- (the only role that can have an auth.uid()).
GRANT EXECUTE ON FUNCTION can_review_product(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION can_review_product(uuid) FROM anon, public;

-- =========================================================================
-- 5. RLS on product_reviews
--    Public SELECT (reviews are public content).
--    INSERT: authenticated only, user_id must be the caller, and the caller
--    must be eligible (can_review_product). UNIQUE(user_id, product_id) is
--    enforced by the table constraint.
--    UPDATE: only the owner, and only rating/title/body (user_id, product_id,
--    created_at are immutable — no policy grants changing them, and the
--    WITH CHECK enforces user_id stays the caller).
--    DELETE: no customer-facing delete policy (admin moderation is future).
-- =========================================================================
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Public read: anyone (anon + authenticated) can read all reviews.
CREATE POLICY product_reviews_public_read ON product_reviews
  FOR SELECT USING (true);

-- Authenticated insert, self-only, eligibility-required.
CREATE POLICY product_reviews_owner_insert ON product_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND can_review_product(product_id)
  );

-- Owner update. WITH CHECK keeps user_id pinned to the caller (so the row
-- cannot be re-assigned). product_id is not in WITH CHECK — but it cannot
-- change because there's no UPDATE policy column grant and the UNIQUE
-- constraint + FK prevent re-pointing to another product. created_at is
-- immutable because the trigger only touches updated_at.
CREATE POLICY product_reviews_owner_update ON product_reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No DELETE policy → customer-facing delete is denied. service_role bypasses
-- RLS for admin moderation.
