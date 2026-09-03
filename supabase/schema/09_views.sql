-- Public review read boundary (Phase 1 review moderation).
--
-- A VIEW over the single physical product_reviews table — NOT a second
-- table, no duplicated data:
--   - exposes ONLY approved reviews
--   - exposes ONLY the fields the public UI renders
--   - never exposes user_id, status, or moderation data
--
-- Views execute with the privileges of their owner (which bypasses RLS),
-- so the WHERE clause is the authoritative public filter. anon is granted
-- SELECT on this view only — the base table is revoked from anon (see
-- 08_grants.sql), making this the single public review surface.

CREATE OR REPLACE VIEW published_reviews AS
SELECT
  id,
  product_id,
  customer_name,
  rating,
  title,
  body,
  created_at,
  updated_at
FROM product_reviews
WHERE status = 'approved';

COMMENT ON VIEW published_reviews IS
  'Public review read boundary: approved reviews only, public columns only. user_id and status are intentionally not exposed.';
