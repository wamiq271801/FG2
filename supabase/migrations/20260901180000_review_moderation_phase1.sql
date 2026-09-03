-- ============================================================
-- Phase 1: Review moderation — status + customer_name snapshot
-- ============================================================
--
-- Purpose
--   1. Add a moderation status to the EXISTING product_reviews table
--      (pending / approved / rejected) — no second physical table.
--   2. New customer-submitted reviews become status = 'pending'.
--      Customers can never choose or change the moderation state.
--   3. Add customer_name — the reviewer's public-name snapshot captured
--      server-side (inside the database) at submission time, so public
--      review rendering no longer depends on the protected profiles
--      table. user_id is retained unchanged for ownership/editing.
--   4. Create published_reviews — a VIEW (not a table) exposing ONLY
--      approved reviews and ONLY the columns the public UI renders.
--   5. Tighten the public SELECT boundary: anon may read ONLY the view;
--      the base table is restricted to approved rows or the owner's own
--      rows (needed for the authenticated ownership/edit flow).
--   6. Fix the pre-existing submission blocker: the storefront review
--      form inserts without user_id and the live table has no default,
--      which violates user_id NOT NULL. Add the standard Supabase
--      DEFAULT auth.uid() so the existing client insert path works.
--
-- Existing rows
--   Reviews that exist before moderation have no moderation history.
--   They are currently publicly visible (product_reviews_public_read
--   was USING (true)), so to avoid silently changing their public
--   meaning they are grandfathered to status = 'approved' — this
--   preserves exactly what is public today. They are NOT rejected and
--   NOT deleted. customer_name is snapshotted from profiles where a
--   full_name exists.
--
-- Idempotency / determinism
--   Guarded with IF NOT EXISTS / OR REPLACE / DROP-IF-EXISTS so the
--   file re-applies cleanly against the schema snapshot. The one-time
--   grandfathering UPDATE is the only intentionally one-time statement:
--   run this migration exactly once against a live database.
--
-- Apply as a single script (Supabase SQL Editor or MCP executes it in
-- one transaction).

-- ─── Step 1: review status type ──────────────────────────────
--
-- Follows the project's enum convention (offer_status_enum,
-- order_status_enum, ...): a constrained Postgres enum, not free text.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'review_status_enum' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.review_status_enum AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$$;

-- ─── Step 2: status column ───────────────────────────────────
--
-- New customer submissions default to 'pending'. The customer cannot
-- submit any other status: Step 5's trigger forces 'pending' on every
-- customer INSERT regardless of what the client sends.

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS status public.review_status_enum
  NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.product_reviews.status IS
  'Moderation state. pending = awaiting moderation, approved = publicly visible, rejected = hidden.';

-- ─── Step 3: customer_name snapshot column ────────────────────
--
-- Nullable: profiles.full_name may legitimately be null; public
-- rendering falls back to "Verified buyer". The value is stamped by
-- the database trigger (Step 5) from the authenticated user's profile,
-- never from client input.

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS customer_name text;

COMMENT ON COLUMN public.product_reviews.customer_name IS
  'Reviewer public-name snapshot at submission time (stamped by stamp_review_moderation from profiles).';

-- ─── Step 4: user_id default (pre-existing submission fix) ────
--
-- The storefront review form (components/review/ReviewForm.tsx) inserts
-- { product_id, rating, title, body } without user_id; the table had no
-- default, so a successful customer insert would violate NOT NULL.
-- DEFAULT auth.uid() is the standard Supabase pattern and keeps the
-- existing insert policy (auth.uid() = user_id) satisfied.

ALTER TABLE public.product_reviews
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ─── Step 5: moderation stamp trigger ─────────────────────────
--
-- Runs inside the database, so the browser can never forge the
-- moderation state or the reviewer name.
--
--   INSERT, customer session (auth.uid() IS NOT NULL):
--     status       := 'pending'  (always — client value is discarded)
--     customer_name := profiles.full_name of the authenticated author
--   INSERT, privileged session (service/secret key, auth.uid() NULL):
--     values pass through unchanged (administrative inserts)
--   UPDATE, customer session (the existing edit flow):
--     status        := OLD.status        (edits never change moderation)
--     customer_name := OLD.customer_name (snapshot stays at submission)
--   UPDATE, privileged session:
--     values pass through — this is the admin approve/reject path
--     (pending -> approved / pending -> rejected).
--
-- Privileged vs customer is safe: the UPDATE policy is scoped TO
-- authenticated (who always carry auth.uid()); role bypass (service)
-- is the only auth.uid()-NULL path.

CREATE OR REPLACE FUNCTION public.stamp_review_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.status := 'pending';
      NEW.customer_name := (
        SELECT p.full_name FROM public.profiles p WHERE p.id = auth.uid()
      );
    END IF;
  ELSE
    IF auth.uid() IS NOT NULL THEN
      NEW.status := OLD.status;
      NEW.customer_name := OLD.customer_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_reviews_moderation ON public.product_reviews;
CREATE TRIGGER trg_product_reviews_moderation
  BEFORE INSERT OR UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.stamp_review_moderation();

-- ─── Step 6: grandfather existing reviews ─────────────────────
--
-- One-time: reviews that predate moderation are currently public, so
-- they become 'approved' (their public meaning is preserved). Their
-- customer_name is snapshotted from profiles where available.

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.product_reviews;
  IF v_count > 0 THEN
    RAISE NOTICE 'Grandfathering % pre-moderation review(s) to approved (public visibility preserved)', v_count;
    UPDATE public.product_reviews SET status = 'approved';
    UPDATE public.product_reviews pr
       SET customer_name = p.full_name
      FROM public.profiles p
     WHERE p.id = pr.user_id
       AND pr.customer_name IS NULL;
  END IF;
END
$$;

-- ─── Step 7: published_reviews view (public read boundary) ────
--
-- A VIEW over the single physical product_reviews table:
--   - exposes ONLY approved reviews
--   - exposes ONLY the fields the public UI renders (id, product,
--     name snapshot, rating, title, body, timestamps)
--   - never exposes user_id, status, or any moderation data
--
-- Views execute with the privileges of their owner (the migration
-- role, which bypasses RLS) — the WHERE clause is therefore the
-- authoritative public filter, and anon access is granted ONLY on the
-- view (Step 9 revokes the base table). PostgREST exposes views in
-- the public schema to granted roles.

CREATE OR REPLACE VIEW public.published_reviews AS
SELECT
  id,
  product_id,
  customer_name,
  rating,
  title,
  body,
  created_at,
  updated_at
FROM public.product_reviews
WHERE status = 'approved';

COMMENT ON VIEW public.published_reviews IS
  'Public review read boundary: approved reviews only, public columns only. user_id and status are intentionally not exposed.';

-- ─── Step 8: indexes ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS product_reviews_published_idx
  ON public.product_reviews (product_id, created_at DESC)
  WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS product_reviews_moderation_queue_idx
  ON public.product_reviews (status, created_at DESC)
  WHERE status <> 'approved';

-- ─── Step 9: policies and grants ──────────────────────────────
--
-- 9a. Function grants for privileged (service/secret-key) sessions.
--     The canonical grants file revoked ALL functions from every role and
--     only re-granted specific ones; generate_sku and can_review_product
--     were never granted to service_role. That blocked API-driven product
--     INSERTs (the assign_product_sku trigger calls generate_sku() when the
--     SKU is blank) and would block admin review moderation
--     (enforce_review_eligibility calls can_review_product on every
--     product_reviews UPDATE). Trigger functions themselves need no EXECUTE
--     grant — only the functions they call internally, as the firing role.

GRANT EXECUTE ON FUNCTION public.generate_sku() TO service_role;
GRANT EXECUTE ON FUNCTION public.can_review_product(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.stamp_review_moderation() TO service_role;

-- 9b. Public SELECT policy (was USING (true)) becomes:
--   approved rows                -> readable (defense in depth for the
--                                   authenticated role; anon does not
--                                   even have base-table grants)
--   own rows (any status)       -> readable by their owner — required
--                                   by the existing authenticated
--                                   ownership/edit flow (review
--                                   eligibility lookup + edit gate)
-- Ownership INSERT/UPDATE policies and the eligibility trigger are
-- untouched.

DROP POLICY IF EXISTS product_reviews_public_read ON public.product_reviews;
CREATE POLICY product_reviews_public_read ON public.product_reviews
  FOR SELECT
  USING (status = 'approved' OR user_id = (select auth.uid()));

-- anon: base table fully revoked; the view is the only public surface.
-- authenticated: keeps base-table SELECT (owner/edit data needs
-- user_id), plus the view for symmetric public reads.
REVOKE SELECT ON public.product_reviews FROM anon;
GRANT SELECT ON public.published_reviews TO anon, authenticated;

-- ─── Step 10: reload PostgREST schema cache ───────────────────

NOTIFY pgrst, 'reload schema';
