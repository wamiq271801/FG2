-- Canonical business schema. All normal application relationships use UUIDs.
-- circulation_entries and circulation_versions are intentionally not defined here.

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  tagline text NOT NULL,
  description text NOT NULL,
  intro text NOT NULL,
  image text NOT NULL,
  accent text NOT NULL,
  subcategories text[] NOT NULL DEFAULT '{}',
  seo_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  country text NOT NULL,
  blurb text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  subtitle text NOT NULL,
  brand_id uuid NOT NULL,
  category_id uuid NOT NULL,
  subcategory text,
  tagline text NOT NULL,
  description text NOT NULL,
  story text NOT NULL DEFAULT '',
  price integer NOT NULL,
  compare_at_price integer,
  currency currency_enum NOT NULL DEFAULT 'INR',
  visual_key product_visual_key_enum NOT NULL,
  accent text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_preorder boolean NOT NULL DEFAULT false,
  highlights text[] NOT NULL DEFAULT '{}',
  includes text[] NOT NULL DEFAULT '{}',
  specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating numeric(2,1) NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  shipping text NOT NULL DEFAULT '',
  warranty text NOT NULL DEFAULT '',
  added_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_variation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_id uuid NOT NULL REFERENCES product_variations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  badge text NOT NULL,
  terms text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  status offer_status_enum NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE offer_products (
  offer_id uuid NOT NULL,
  product_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  phone text,
  avatar_url text,
  onboarding_state onboarding_state_enum NOT NULL DEFAULT 'incomplete',
  pref_newsletter boolean NOT NULL DEFAULT true,
  pref_product_updates boolean NOT NULL DEFAULT true,
  pref_order_updates boolean NOT NULL DEFAULT true,
  member_since date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  state text NOT NULL,
  postcode text NOT NULL,
  country text NOT NULL,
  phone text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  user_id uuid NOT NULL,
  status order_status_enum NOT NULL DEFAULT 'processing',
  payment_method payment_method_enum NOT NULL DEFAULT 'cod',
  payment_status payment_status_enum NOT NULL DEFAULT 'pending',
  currency currency_enum NOT NULL DEFAULT 'INR',
  subtotal integer NOT NULL,
  discount_total integer NOT NULL DEFAULT 0,
  shipping_total integer NOT NULL DEFAULT 0,
  tax_total integer NOT NULL DEFAULT 0,
  total integer NOT NULL,
  ship_label text NOT NULL,
  ship_line1 text NOT NULL,
  ship_line2 text,
  ship_city text NOT NULL,
  ship_state text NOT NULL,
  ship_postcode text NOT NULL,
  ship_country text NOT NULL,
  ship_phone text NOT NULL,
  tracking_number text,
  estimated_delivery date,
  idempotency_key text NOT NULL,
  idempotency_request_hash text NOT NULL,
  placed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  product_sku text NOT NULL,
  visual_key product_visual_key_enum NOT NULL,
  accent text NOT NULL,
  quantity integer NOT NULL,
  unit_price integer NOT NULL,
  line_discount integer NOT NULL DEFAULT 0,
  line_total integer NOT NULL
);

CREATE TABLE order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE TABLE product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  rating integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE signup_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  email_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE worker_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  dimension rate_limit_dimension_enum NOT NULL,
  subject_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
