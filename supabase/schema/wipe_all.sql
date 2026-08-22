-- ============================================================
-- WIPE ALL — Fusion Gadgets Database
-- ============================================================
-- Drops all objects so schema can be rebuilt from scratch.
-- After running this, execute schema/*.sql in order (00–09),
-- then run seed_generated.sql.
-- ============================================================

-- Tables first (CASCADE drops triggers, policies, constraints)
DROP TABLE IF EXISTS product_reviews CASCADE;
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
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_highlights CASCADE;
DROP TABLE IF EXISTS product_specs CASCADE;
DROP TABLE IF EXISTS product_includes CASCADE;
DROP TABLE IF EXISTS product_badges CASCADE;
DROP TABLE IF EXISTS product_related CASCADE;

-- Constraints
ALTER TABLE IF EXISTS profiles DROP CONSTRAINT IF EXISTS profiles_auth_user_fkey;

-- Sequences
DROP SEQUENCE IF EXISTS order_number_seq CASCADE;

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

-- Types
DROP TYPE IF EXISTS currency_enum CASCADE;
DROP TYPE IF EXISTS product_visual_key_enum CASCADE;
DROP TYPE IF EXISTS order_status_enum CASCADE;
DROP TYPE IF EXISTS payment_method_enum CASCADE;
DROP TYPE IF EXISTS payment_status_enum CASCADE;
DROP TYPE IF EXISTS offer_status_enum CASCADE;
DROP TYPE IF EXISTS onboarding_state_enum CASCADE;
DROP TYPE IF EXISTS rate_limit_dimension_enum CASCADE;

-- Extensions
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
