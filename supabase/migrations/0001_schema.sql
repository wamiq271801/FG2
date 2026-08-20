-- Fusion Gadgets — Phase 1 schema foundation.
-- Run on a fresh Supabase Postgres project. Idempotent-safe for catalog tables
-- (uses CREATE TYPE ... DO $$ / CREATE TABLE IF NOT EXISTS where reasonable).
--
-- Design rules followed:
--  - Money stored as integer (whole rupees) to match the existing UI (en-IN, 0 fractions).
--  - Catalog tables (categories/brands/products/...) use stable slug/text primary keys.
--  - User-owned tables use uuid PKs and a user_id FK -> auth.users(id).
--  - Order items store historical snapshots so past orders never depend on current product rows.
--  - No JSON blobs for relational data; no speculative columns.

-- =========================================================================
-- ENUMS
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE availability_enum AS ENUM ('in-stock', 'low-stock', 'out-of-stock', 'preorder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_visual_key_enum AS ENUM (
    'headphones','earbuds','speaker','keyboard','mouse','watch',
    'camera','lens','drone','charger','cable','stand','lamp',
    'backpack','controller','mic','monitor','tracker'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE currency_enum AS ENUM ('INR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status_enum AS ENUM (
    'processing','confirmed','shipped','out-for-delivery','delivered','cancelled','returned'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- COD-only for production checkout, but the enum records the methods the UI already supports
  -- so later phases don't need an ALTER. Card/UPI remain non-production for now.
  CREATE TYPE payment_method_enum AS ENUM ('cod','card','upi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status_enum AS ENUM ('pending','paid','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE offer_status_enum AS ENUM ('draft','scheduled','active','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_state_enum AS ENUM ('incomplete','complete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE circulation_surface_enum AS ENUM (
    'home_trending','home_new_arrivals','home_featured','home_on_sale','shop_default'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE circulation_version_status_enum AS ENUM ('building','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- UPDATED_AT TRIGGER FUNCTION (shared)
-- =========================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================================
-- CATALOG: categories
-- =========================================================================
CREATE TABLE IF NOT EXISTS categories (
  slug           text PRIMARY KEY,
  name           text NOT NULL,
  tagline        text NOT NULL,
  description    text NOT NULL,
  intro          text NOT NULL,
  image          text NOT NULL,
  accent         text NOT NULL,
  subcategories  text[] NOT NULL DEFAULT '{}',
  featured       text[] NOT NULL DEFAULT '{}',   -- product slugs
  seo_note       text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- CATALOG: brands
-- =========================================================================
CREATE TABLE IF NOT EXISTS brands (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  country     text NOT NULL,           -- free text ("India", "Sweden")
  blurb       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- CATALOG: products
-- Public read-only. No public write policies (see 0002_rls_policies.sql).
-- =========================================================================
CREATE TABLE IF NOT EXISTS products (
  slug          text PRIMARY KEY,
  name          text NOT NULL,
  subtitle      text NOT NULL,
  brand_slug    text NOT NULL REFERENCES brands(slug) ON DELETE RESTRICT,
  category_slug text NOT NULL REFERENCES categories(slug) ON DELETE RESTRICT,
  subcategory   text,
  tagline       text NOT NULL,
  description   text NOT NULL,
  story         text NOT NULL DEFAULT '',
  price         integer NOT NULL CHECK (price >= 0),
  compare_at    integer CHECK (compare_at IS NULL OR compare_at >= 0),
  currency      currency_enum NOT NULL DEFAULT 'INR',
  visual_key    product_visual_key_enum NOT NULL,
  accent        text NOT NULL,
  availability  availability_enum NOT NULL DEFAULT 'in-stock',
  stock         integer CHECK (stock IS NULL OR stock >= 0),
  rating        numeric(2,1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  review_count  integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  shipping      text NOT NULL DEFAULT '',
  warranty      text NOT NULL DEFAULT '',
  added_at      date NOT NULL DEFAULT CURRENT_DATE,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_compare_at_gt_price CHECK (compare_at IS NULL OR compare_at > price)
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_slug) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_products_availability ON products(availability) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_products_added_at ON products(added_at DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- =========================================================================
-- CATALOG: product_images (multiple ordered URLs, first = primary)
-- =========================================================================
CREATE TABLE IF NOT EXISTS product_images (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  url          text NOT NULL,
  position     integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_slug, position),
  UNIQUE(product_slug, is_primary) DEFERRABLE INITIALLY DEFERRED  -- at most one primary
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_slug, position);

-- =========================================================================
-- CATALOG: product_variants
-- =========================================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  variant_id   text NOT NULL,          -- e.g. "graphite"
  name         text NOT NULL,
  price_delta  integer DEFAULT 0,
  swatch       text,
  in_stock     boolean NOT NULL DEFAULT true,
  position     integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_slug, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_slug, position);

-- =========================================================================
-- CATALOG: product_specs (label/value list)
-- =========================================================================
CREATE TABLE IF NOT EXISTS product_specs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  label        text NOT NULL,
  value        text NOT NULL,
  position     integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  UNIQUE(product_slug, position)
);
CREATE INDEX IF NOT EXISTS idx_product_specs_product ON product_specs(product_slug, position);

-- =========================================================================
-- CATALOG: product_highlights (ordered bullet list)
-- =========================================================================
CREATE TABLE IF NOT EXISTS product_highlights (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  body         text NOT NULL,
  position     integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  UNIQUE(product_slug, position)
);
CREATE INDEX IF NOT EXISTS idx_product_highlights_product ON product_highlights(product_slug, position);

-- =========================================================================
-- CATALOG: product_includes ("what's in the box")
-- =========================================================================
CREATE TABLE IF NOT EXISTS product_includes (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  body         text NOT NULL,
  position     integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  UNIQUE(product_slug, position)
);
CREATE INDEX IF NOT EXISTS idx_product_includes_product ON product_includes(product_slug, position);

-- =========================================================================
-- CATALOG: product_badges (ordered display labels)
-- =========================================================================
CREATE TABLE IF NOT EXISTS product_badges (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  badge        text NOT NULL,
  position     integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  UNIQUE(product_slug, position)
);
CREATE INDEX IF NOT EXISTS idx_product_badges_product ON product_badges(product_slug, position);

-- =========================================================================
-- CATALOG: product_related (self-referential M:N)
-- =========================================================================
CREATE TABLE IF NOT EXISTS product_related (
  product_slug    text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  related_slug    text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  position        integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  PRIMARY KEY (product_slug, related_slug),
  CHECK (product_slug <> related_slug)
);

-- =========================================================================
-- CATALOG: product_reviews (editorial seed; author is free text for now)
-- =========================================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  author        text NOT NULL,
  rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_date   date NOT NULL,
  title         text NOT NULL,
  body          text NOT NULL,
  verified      boolean NOT NULL DEFAULT true,
  position      integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_slug, position)
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_slug, position);

-- =========================================================================
-- OFFERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS offers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  title       text NOT NULL,
  description text NOT NULL,
  badge       text NOT NULL,
  terms       text NOT NULL,
  starts_at   timestamptz,
  ends_at     timestamptz,
  status      offer_status_enum NOT NULL DEFAULT 'draft',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_date_order CHECK (
    starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at
  )
);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_dates ON offers(starts_at, ends_at);

CREATE TABLE IF NOT EXISTS offer_products (
  offer_id     uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  PRIMARY KEY (offer_id, product_slug)
);
CREATE INDEX IF NOT EXISTS idx_offer_products_offer ON offer_products(offer_id, position);
CREATE INDEX IF NOT EXISTS idx_offer_products_product ON offer_products(product_slug);

-- =========================================================================
-- USER-OWNED: profiles (1:1 with auth.users)
-- =========================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                      text NOT NULL UNIQUE,
  full_name                  text,
  phone                      text,
  avatar_url                 text,
  onboarding_state           onboarding_state_enum NOT NULL DEFAULT 'incomplete',
  pref_newsletter            boolean NOT NULL DEFAULT true,
  pref_product_updates       boolean NOT NULL DEFAULT true,
  pref_order_updates         boolean NOT NULL DEFAULT true,
  member_since               date NOT NULL DEFAULT CURRENT_DATE,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- USER-OWNED: addresses (optional before checkout)
-- =========================================================================
CREATE TABLE IF NOT EXISTS addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label       text NOT NULL,
  line1       text NOT NULL,
  line2       text,
  city        text NOT NULL,
  state       text NOT NULL,
  postcode    text NOT NULL,
  country     text NOT NULL,
  phone       text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
-- At most one default address per user:
CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_default_per_user
  ON addresses(user_id) WHERE is_default;

-- =========================================================================
-- USER-OWNED: cart_items
-- variant_id '' denotes "no variant" so the uniqueness constraint is clean.
-- =========================================================================
CREATE TABLE IF NOT EXISTS cart_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  variant_id   text NOT NULL DEFAULT '',
  quantity     integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_slug, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);

-- =========================================================================
-- USER-OWNED: wishlist_items (one entry per product per user)
-- =========================================================================
CREATE TABLE IF NOT EXISTS wishlist_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_slug)
);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user ON wishlist_items(user_id);

-- =========================================================================
-- ORDERS (historical truth, COD-only for production)
-- order_items store snapshots; product_slug is a soft reference (ON DELETE SET NULL)
-- so deleting a product never breaks historical rendering.
-- =========================================================================
CREATE TABLE IF NOT EXISTS orders (
  id                 text PRIMARY KEY,            -- "FG-YYYY-NNNN"
  user_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status             order_status_enum NOT NULL DEFAULT 'processing',
  payment_method     payment_method_enum NOT NULL DEFAULT 'cod',
  payment_status     payment_status_enum NOT NULL DEFAULT 'pending',
  currency           currency_enum NOT NULL DEFAULT 'INR',
  subtotal           integer NOT NULL CHECK (subtotal >= 0),
  discount_total     integer NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  shipping_total     integer NOT NULL DEFAULT 0 CHECK (shipping_total >= 0),
  tax_total          integer NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total              integer NOT NULL CHECK (total >= 0),
  -- delivery address snapshot (independent of current saved address)
  ship_label         text NOT NULL,
  ship_line1         text NOT NULL,
  ship_line2         text,
  ship_city          text NOT NULL,
  ship_state         text NOT NULL,
  ship_postcode      text NOT NULL,
  ship_country       text NOT NULL,
  ship_phone         text NOT NULL,
  tracking_number    text,
  estimated_delivery date,
  placed_at          timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, placed_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_slug  text REFERENCES products(slug) ON DELETE SET NULL,
  -- historical snapshots (always populated; survive product deletion)
  product_name  text NOT NULL,
  variant_name  text,
  visual_key    product_visual_key_enum NOT NULL,
  accent        text NOT NULL,
  quantity      integer NOT NULL CHECK (quantity >= 1),
  unit_price    integer NOT NULL CHECK (unit_price >= 0),
  line_discount integer NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  line_total    integer NOT NULL CHECK (line_total >= 0),
  UNIQUE(order_id, product_slug, variant_name)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_timeline (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  step_label  text NOT NULL,
  step_date   timestamptz,
  step_index  integer NOT NULL CHECK (step_index >= 0),
  done        boolean NOT NULL DEFAULT false,
  UNIQUE(order_id, step_index)
);
CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id, step_index);

-- =========================================================================
-- PUBLISHED CIRCULATION (ready-to-consume output for Next.js ISR)
-- Only complete published versions are read by the storefront. A 'building'
-- version that crashes mid-build is simply ignored; the previous 'published'
-- version remains current until a new one succeeds.
-- =========================================================================
CREATE TABLE IF NOT EXISTS circulation_versions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version       bigint NOT NULL,            -- monotonic version number
  status        circulation_version_status_enum NOT NULL DEFAULT 'building',
  built_at      timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_circulation_versions_status ON circulation_versions(status);
-- Only one published version at a time:
CREATE UNIQUE INDEX IF NOT EXISTS idx_circulation_single_published
  ON circulation_versions((1)) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS circulation_entries (
  version_id    bigint NOT NULL REFERENCES circulation_versions(id) ON DELETE CASCADE,
  surface       circulation_surface_enum NOT NULL,
  product_slug  text NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  position      integer NOT NULL CHECK (position >= 0),
  score         numeric(10,4),
  PRIMARY KEY (version_id, surface, position),
  UNIQUE(version_id, surface, product_slug)
);
CREATE INDEX IF NOT EXISTS idx_circulation_entries_surface
  ON circulation_entries(surface, position);

-- =========================================================================
-- updated_at TRIGGERS (one per table with updated_at)
-- =========================================================================
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_offers_updated_at BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- AUTH -> PROFILE auto-create (fires on Supabase Auth signup, including
-- signups initiated by the Worker via the service-role admin API).
-- New profiles start with onboarding_state='incomplete'.
-- =========================================================================
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
