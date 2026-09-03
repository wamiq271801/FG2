-- ============================================================
-- WIPE AND REBUILD — Fusion Gadgets Database
-- ============================================================
-- WARNING: This destroys ALL existing data.
-- Run this in the Supabase SQL Editor (one block at a time
-- if your editor has statement limits).
-- ============================================================

-- ─── PHASE 1: Drop everything ───────────────────────────────

-- Triggers first (they reference functions)
DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS trg_brands_updated_at ON brands;
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
DROP TRIGGER IF EXISTS trg_product_images_updated_at ON product_images;
DROP TRIGGER IF EXISTS trg_product_variations_updated_at ON product_variations;
DROP TRIGGER IF EXISTS trg_product_variation_items_updated_at ON product_variation_items;
DROP TRIGGER IF EXISTS trg_offers_updated_at ON offers;
DROP TRIGGER IF EXISTS trg_offer_products_updated_at ON offer_products;
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS trg_product_reviews_updated_at ON product_reviews;
DROP TRIGGER IF EXISTS trg_signup_authorizations_updated_at ON signup_authorizations;
DROP TRIGGER IF EXISTS trg_worker_rate_limits_updated_at ON worker_rate_limits;
DROP TRIGGER IF EXISTS trg_products_assign_sku ON products;
DROP TRIGGER IF EXISTS trg_order_events_reject_mutation ON order_events;
DROP TRIGGER IF EXISTS trg_product_reviews_enforce_eligibility ON product_reviews;
DROP TRIGGER IF EXISTS trg_product_reviews_eligibility ON product_reviews;
DROP TRIGGER IF EXISTS trg_product_reviews_moderation ON product_reviews;
DROP TRIGGER IF EXISTS trg_auth_users AFTER INSERT ON auth.users;

-- Policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Tables (reverse dependency order)
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP VIEW IF EXISTS published_reviews;
DROP TABLE IF EXISTS order_events CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS wishlist_items CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS worker_rate_limits CASCADE;
DROP TABLE IF EXISTS signup_authorizations CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS offer_products CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS product_variation_items CASCADE;
DROP TABLE IF EXISTS product_variations CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Also drop the old table if it still exists
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_highlights CASCADE;
DROP TABLE IF EXISTS product_specs CASCADE;
DROP TABLE IF EXISTS product_includes CASCADE;
DROP TABLE IF EXISTS product_badges CASCADE;
DROP TABLE IF EXISTS product_related CASCADE;

-- Functions
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS generate_sku() CASCADE;
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;
DROP FUNCTION IF EXISTS handle_new_auth_user() CASCADE;
DROP FUNCTION IF EXISTS consume_signup_authorization(text, text) CASCADE;
DROP FUNCTION IF EXISTS hook_validate_signup_authorization(jsonb) CASCADE;
DROP FUNCTION IF EXISTS can_review_product(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_legal_order_transition(order_status_enum, order_status_enum) CASCADE;
DROP FUNCTION IF EXISTS enforce_order_status_transition() CASCADE;
DROP FUNCTION IF EXISTS check_rate_limit(text, integer, interval) CASCADE;
DROP FUNCTION IF EXISTS create_order(uuid, jsonb, jsonb) CASCADE;
DROP FUNCTION IF EXISTS change_order_status(uuid, order_status_enum, jsonb) CASCADE;
DROP FUNCTION IF EXISTS cancel_order(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS return_order(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS get_related_products(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS assign_product_sku() CASCADE;
DROP FUNCTION IF EXISTS reject_order_event_mutation() CASCADE;
DROP FUNCTION IF EXISTS enforce_review_eligibility() CASCADE;

-- Types (only if no remaining dependents)
DROP TYPE IF EXISTS currency_enum CASCADE;
DROP TYPE IF EXISTS product_visual_key_enum CASCADE;
DROP TYPE IF EXISTS order_status_enum CASCADE;
DROP TYPE IF EXISTS payment_method_enum CASCADE;
DROP TYPE IF EXISTS payment_status_enum CASCADE;
DROP TYPE IF EXISTS offer_status_enum CASCADE;
DROP TYPE IF EXISTS onboarding_state_enum CASCADE;
DROP TYPE IF EXISTS rate_limit_dimension_enum CASCADE;

-- Extensions (safe to re-create)
DROP EXTENSION IF EXISTS pgcrypto CASCADE;

-- ─── PHASE 2: Recreate schema ───────────────────────────────
-- Run each file in order. If your SQL editor supports \i or
-- similar, use that. Otherwise paste each block manually.

-- 00_extensions.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 01_types.sql (paste contents of 01_types.sql here)
-- 02_tables.sql (paste contents of 02_tables.sql here)
-- 03_constraints.sql (paste contents of 03_constraints.sql here)
-- 04_indexes.sql (paste contents of 04_indexes.sql here)
-- 05_functions.sql (paste contents of 05_functions.sql here)
-- 06_triggers.sql (paste contents of 06_triggers.sql here)
-- 07_rls.sql (paste contents of 07_rls.sql here)
-- 08_grants.sql (paste contents of 08_grants.sql here)
-- 09_views.sql (paste contents of 09_views.sql here)
-- 10_seed.sql (paste contents of 09_seed.sql here)

-- ─── PHASE 3: Seed data ─────────────────────────────────────
-- Run seed_generated.sql after schema is recreated.
