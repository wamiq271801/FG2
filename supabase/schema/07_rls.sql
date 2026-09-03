ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_public_read ON categories;
CREATE POLICY categories_public_read ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS brands_public_read ON brands;
CREATE POLICY brands_public_read ON brands FOR SELECT USING (true);
DROP POLICY IF EXISTS products_public_active_read ON products;
CREATE POLICY products_public_active_read ON products FOR SELECT USING (is_active);
DROP POLICY IF EXISTS product_images_public_read ON product_images;
CREATE POLICY product_images_public_read ON product_images FOR SELECT USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_images.product_id AND p.is_active));
DROP POLICY IF EXISTS product_variations_public_read ON product_variations;
CREATE POLICY product_variations_public_read ON product_variations FOR SELECT USING (true);
DROP POLICY IF EXISTS product_variation_items_public_read ON product_variation_items;
CREATE POLICY product_variation_items_public_read ON product_variation_items FOR SELECT USING (EXISTS (SELECT 1 FROM products p JOIN product_variation_items pvi ON pvi.product_id = p.id WHERE pvi.variation_id = product_variation_items.variation_id AND p.is_active));
DROP POLICY IF EXISTS offers_public_read ON offers;
CREATE POLICY offers_public_read ON offers FOR SELECT USING (status IN ('active', 'expired'));
DROP POLICY IF EXISTS offer_products_public_read ON offer_products;
CREATE POLICY offer_products_public_read ON offer_products FOR SELECT USING (EXISTS (SELECT 1 FROM offers o WHERE o.id = offer_products.offer_id AND o.status IN ('active', 'expired')));

DROP POLICY IF EXISTS profiles_owner_select ON profiles;
CREATE POLICY profiles_owner_select ON profiles FOR SELECT TO authenticated USING ((select auth.uid()) = id);
DROP POLICY IF EXISTS profiles_owner_update ON profiles;
CREATE POLICY profiles_owner_update ON profiles FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);
DROP POLICY IF EXISTS addresses_owner_all ON addresses;
CREATE POLICY addresses_owner_all ON addresses FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS cart_items_owner_all ON cart_items;
CREATE POLICY cart_items_owner_all ON cart_items FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS wishlist_items_owner_all ON wishlist_items;
CREATE POLICY wishlist_items_owner_all ON wishlist_items FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS orders_owner_read ON orders;
CREATE POLICY orders_owner_read ON orders FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS order_items_owner_read ON order_items;
CREATE POLICY order_items_owner_read ON order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = (select auth.uid())));
DROP POLICY IF EXISTS order_events_owner_read ON order_events;
CREATE POLICY order_events_owner_read ON order_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_events.order_id AND o.user_id = (select auth.uid())));
DROP POLICY IF EXISTS product_reviews_public_read ON product_reviews;
-- Approved reviews are publicly readable; a user can additionally read
-- their OWN review in any status (the authenticated ownership/edit flow
-- needs to find pending rows). anon never touches the base table — it
-- reads published_reviews (see 09_views.sql / 08_grants.sql).
CREATE POLICY product_reviews_public_read ON product_reviews FOR SELECT USING (status = 'approved' OR user_id = (select auth.uid()));
DROP POLICY IF EXISTS product_reviews_owner_insert ON product_reviews;
CREATE POLICY product_reviews_owner_insert ON product_reviews FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id AND can_review_product(product_id));
DROP POLICY IF EXISTS product_reviews_owner_update ON product_reviews;
CREATE POLICY product_reviews_owner_update ON product_reviews FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id AND can_review_product(product_id));

-- No browser policy exists for signup_authorizations or worker_rate_limits.
