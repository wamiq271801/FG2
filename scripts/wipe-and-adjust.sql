-- ============================================================
-- WIPE + SCHEMA ADJUSTMENTS
-- Run this BEFORE the import script.
-- ============================================================

-- 1. Disable immutable trigger on order_events
ALTER TABLE order_events DISABLE TRIGGER trg_order_events_immutable;

-- 2. Wipe existing data (order matters for FKs)
DELETE FROM order_events;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM offer_products;
DELETE FROM offers;
DELETE FROM product_variation_items;
DELETE FROM product_variations;
DELETE FROM product_reviews;
DELETE FROM wishlist_items;
DELETE FROM cart_items;
DELETE FROM product_images;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM brands;

-- 3. Re-enable immutable trigger
ALTER TABLE order_events ENABLE TRIGGER trg_order_events_immutable;

-- 4. Make brand_id and category_id nullable (for unbranded products)
ALTER TABLE products ALTER COLUMN brand_id DROP NOT NULL;
ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL;

-- Done. Now run the import script.
SELECT 'Wipe complete. Products, brands, categories cleared. Schema adjusted.' as status;
