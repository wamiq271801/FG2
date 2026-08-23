-- ============================================================
-- profiles ↔ auth.users integrity + orphan-profile recovery
-- ============================================================
--
-- This migration:
--   1. Cleans up existing orphan profiles (no matching auth.users row)
--   2. Replaces handle_new_auth_user() with explicit recovery logic
--   3. Adds FK: profiles.id → auth.users.id ON DELETE CASCADE
--
-- The trigger now follows this decision tree for NEW auth users:
--   - No matching profile       → create new profile
--   - Profile.id = NEW.id       → already belongs to this user (no-op)
--   - Orphan profile (no auth)  → recover: update FKs + profile id
--   - Active user's profile     → reject signup (RAISE EXCEPTION)
-- ============================================================

-- ─── Step 1: Clean up orphan profiles ──────────────────────────
--
-- The orders table uses ON DELETE RESTRICT, so we must delete
-- orders for orphan profiles BEFORE deleting the profiles.
-- The order_events table has an immutability trigger that blocks
-- CASCADE from orders, so we must disable it temporarily.

-- 1a. Disable order_events immutability trigger (allows cascade from orders)
ALTER TABLE public.order_events DISABLE TRIGGER trg_order_events_immutable;

-- 1b. Delete order_events for orphan orders (CASCADE from orders needs this)
DELETE FROM public.order_events
WHERE order_id IN (
  SELECT o.id FROM public.orders o
  WHERE o.user_id IN (
    SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  )
);

-- 1c. Delete orders for orphan profiles (RESTRICT blocks profile deletion)
DELETE FROM public.orders
WHERE user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
);

-- 1d. Re-enable order_events immutability trigger
ALTER TABLE public.order_events ENABLE TRIGGER trg_order_events_immutable;

-- 1e. Delete all orphan profiles
-- CASCADE cleans up: addresses, cart_items, product_reviews, wishlist_items
DELETE FROM public.profiles
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = profiles.id);

-- ─── Step 2: Replace handle_new_auth_user() ────────────────────
--
-- SECURITY DEFINER + explicit search_path preserved.
-- Uses atomic recovery: update FKs first, then profile id.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized_email text;
  v_existing_profile  record;
BEGIN
  v_normalized_email := lower(trim(COALESCE(NEW.email, '')));

  -- Look for an existing profile with the same normalized email
  SELECT * INTO v_existing_profile
  FROM public.profiles
  WHERE lower(trim(email)) = v_normalized_email
  LIMIT 1;

  IF NOT FOUND THEN
    -- ── Case 1: No matching profile → create new ──
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, COALESCE(NEW.email, ''));

  ELSIF v_existing_profile.id = NEW.id THEN
    -- ── Case 2: Profile already belongs to this user → no-op ──
    -- This handles the case where the trigger fires but the profile
    -- was already created (e.g. by a previous operation).
    NULL;

  ELSIF EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = v_existing_profile.id
  ) THEN
    -- ── Case 3: Profile belongs to another active Auth user → reject ──
    -- Do not merge accounts. The signup must fail safely.
    RAISE EXCEPTION 'Email address is already registered';

  ELSE
    -- ── Case 4: Orphan profile → recover ──
    -- Update all FK references from orphan_id to NEW.id,
    -- then update the profile itself.

    -- Update dependent tables (order matters: do tables with RESTRICT last)
    UPDATE public.addresses        SET user_id = NEW.id WHERE user_id = v_existing_profile.id;
    UPDATE public.cart_items       SET user_id = NEW.id WHERE user_id = v_existing_profile.id;
    UPDATE public.product_reviews  SET user_id = NEW.id WHERE user_id = v_existing_profile.id;
    UPDATE public.wishlist_items   SET user_id = NEW.id WHERE user_id = v_existing_profile.id;

    -- Update the profile identity (id + email)
    UPDATE public.profiles
    SET id    = NEW.id,
        email = COALESCE(NEW.email, '')
    WHERE id = v_existing_profile.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Step 3: Add FK constraint ─────────────────────────────────
--
-- profiles.id → auth.users.id
-- ON DELETE CASCADE: deleting an Auth user automatically removes its profile.
-- Must be added AFTER orphan cleanup (orphans violate this FK).

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_auth_users_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- ─── Step 4: Verify trigger is enabled ─────────────────────────
-- (No-op if already enabled; the trigger should already exist.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgenabled = 'O'
  ) THEN
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
