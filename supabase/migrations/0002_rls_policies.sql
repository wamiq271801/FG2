-- Fusion Gadgets — Phase 1 Row-Level Security.
-- Run AFTER 0001_schema.sql. Enables RLS on every table and defines ownership
-- policies. Catalog/offers/circulation are public-read, NO public write.
-- User-owned tables enforce auth.uid() ownership. Orders are user-read-only
-- (creation is Worker-protected in a later phase).

-- =========================================================================
-- CATALOG: public read, NO user write
-- (No INSERT/UPDATE/DELETE policy => denied to anon+authenticated. Only the
--  service_role / postgres roles bypass RLS, which is exactly the intended
--  admin boundary.)
-- =========================================================================
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands                ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_specs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_highlights    ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_includes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_badges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_related       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_public_read"   ON categories         FOR SELECT USING (true);
CREATE POLICY "brands_public_read"       ON brands             FOR SELECT USING (true);
CREATE POLICY "products_public_read"     ON products           FOR SELECT USING (true);
CREATE POLICY "product_images_read"      ON product_images     FOR SELECT USING (true);
CREATE POLICY "product_variants_read"    ON product_variants   FOR SELECT USING (true);
CREATE POLICY "product_specs_read"       ON product_specs      FOR SELECT USING (true);
CREATE POLICY "product_highlights_read"  ON product_highlights FOR SELECT USING (true);
CREATE POLICY "product_includes_read"    ON product_includes   FOR SELECT USING (true);
CREATE POLICY "product_badges_read"      ON product_badges     FOR SELECT USING (true);
CREATE POLICY "product_related_read"     ON product_related    FOR SELECT USING (true);
CREATE POLICY "product_reviews_read"     ON product_reviews    FOR SELECT USING (true);

-- =========================================================================
-- OFFERS: public read of active/expired for storefront display.
-- No user write. Status filtering happens in queries; the policy just allows
-- the read so the UI can render lifecycle states (active/ended) from status+dates.
-- =========================================================================
ALTER TABLE offers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers_public_read"         ON offers         FOR SELECT USING (true);
CREATE POLICY "offer_products_public_read" ON offer_products FOR SELECT USING (true);

-- =========================================================================
-- PROFILES: a user reads and updates ONLY their own profile row.
-- No DELETE (profile lifetime tied to auth.users via ON DELETE CASCADE).
-- No INSERT (created by the auth trigger).
-- =========================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_read"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =========================================================================
-- ADDRESSES: full ownership CRUD (read/insert/update/delete own).
-- =========================================================================
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses_owner_all" ON addresses
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- CART ITEMS: full ownership CRUD.
-- =========================================================================
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_items_owner_all" ON cart_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- WISHLIST ITEMS: full ownership CRUD.
-- (UNIQUE(user_id, product_slug) already prevents duplicate ownership at the
--  database level; this policy only enforces the user boundary.)
-- =========================================================================
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_items_owner_all" ON wishlist_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- ORDERS: user can READ their own orders only.
-- NO user INSERT/UPDATE/DELETE — order creation is a Worker-protected sensitive
-- operation (Phase 5). The service_role bypasses RLS to insert orders.
-- =========================================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_owner_read" ON orders
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_owner_read" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_timeline_owner_read" ON order_timeline
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_timeline.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- =========================================================================
-- CIRCULATION: public read of PUBLISHED versions only.
-- Building/archived versions are invisible to the storefront so a half-written
-- result is never exposed. No user write (processor uses service_role).
-- =========================================================================
ALTER TABLE circulation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE circulation_entries  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circulation_versions_published_read" ON circulation_versions
  FOR SELECT USING (status = 'published');

CREATE POLICY "circulation_entries_published_read" ON circulation_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circulation_versions v
      WHERE v.id = circulation_entries.version_id
        AND v.status = 'published'
    )
  );
