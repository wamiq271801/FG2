ALTER TABLE categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
ALTER TABLE brands ADD CONSTRAINT brands_slug_key UNIQUE (slug);
ALTER TABLE products ADD CONSTRAINT products_sku_key UNIQUE (sku);
ALTER TABLE products ADD CONSTRAINT products_slug_key UNIQUE (slug);
ALTER TABLE products ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT;
ALTER TABLE products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;
ALTER TABLE products ADD CONSTRAINT products_sku_format CHECK (sku ~ '^[A-Z0-9]{1,10}$');
ALTER TABLE products ADD CONSTRAINT products_price_nonnegative CHECK (price >= 0);
ALTER TABLE products ADD CONSTRAINT products_compare_at_price CHECK (compare_at_price IS NULL OR compare_at_price > price);
ALTER TABLE products ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0);
ALTER TABLE products ADD CONSTRAINT products_specs_array CHECK (jsonb_typeof(specs) = 'array');
ALTER TABLE products ADD CONSTRAINT products_rating_range CHECK (rating BETWEEN 0 AND 5);
ALTER TABLE products ADD CONSTRAINT products_review_count_nonnegative CHECK (review_count >= 0);

ALTER TABLE product_images ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_images ADD CONSTRAINT product_images_position_nonnegative CHECK (position >= 0);
ALTER TABLE product_images ADD CONSTRAINT product_images_product_position_key UNIQUE (product_id, position);

ALTER TABLE product_variation_items ADD CONSTRAINT product_variation_items_variation_id_fkey FOREIGN KEY (variation_id) REFERENCES product_variations(id) ON DELETE CASCADE;
ALTER TABLE product_variation_items ADD CONSTRAINT product_variation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_variation_items ADD CONSTRAINT product_variation_items_position_nonnegative CHECK (position >= 0);
ALTER TABLE product_variation_items ADD CONSTRAINT product_variation_items_option_label_nonempty CHECK (option_label <> '');
ALTER TABLE product_variation_items ADD CONSTRAINT product_variation_items_variation_product_key UNIQUE (variation_id, product_id);
ALTER TABLE product_variation_items ADD CONSTRAINT product_variation_items_variation_position_key UNIQUE (variation_id, position);

ALTER TABLE offers ADD CONSTRAINT offers_slug_key UNIQUE (slug);
ALTER TABLE offers ADD CONSTRAINT offers_date_order CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
ALTER TABLE offer_products ADD CONSTRAINT offer_products_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;
ALTER TABLE offer_products ADD CONSTRAINT fk_offer_products_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE offer_products ADD CONSTRAINT offer_products_position_nonnegative CHECK (position >= 0);
ALTER TABLE offer_products ADD CONSTRAINT offer_products_key PRIMARY KEY (offer_id, product_id);
ALTER TABLE offer_products ADD CONSTRAINT offer_products_offer_position_key UNIQUE (offer_id, position);

ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
ALTER TABLE addresses ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE cart_items ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE cart_items ADD CONSTRAINT fk_cart_items_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity_range CHECK (quantity BETWEEN 1 AND 99);
ALTER TABLE cart_items ADD CONSTRAINT cart_items_user_product_key UNIQUE (user_id, product_id);
ALTER TABLE wishlist_items ADD CONSTRAINT wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE wishlist_items ADD CONSTRAINT wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE wishlist_items ADD CONSTRAINT wishlist_items_user_product_key UNIQUE (user_id, product_id);

ALTER TABLE orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE orders ADD CONSTRAINT orders_idempotency_user_key UNIQUE (user_id, idempotency_key);
ALTER TABLE orders ADD CONSTRAINT orders_subtotal_nonnegative CHECK (subtotal >= 0);
ALTER TABLE orders ADD CONSTRAINT orders_discount_nonnegative CHECK (discount_total >= 0);
ALTER TABLE orders ADD CONSTRAINT orders_shipping_nonnegative CHECK (shipping_total >= 0);
ALTER TABLE orders ADD CONSTRAINT orders_tax_nonnegative CHECK (tax_total >= 0);
ALTER TABLE orders ADD CONSTRAINT orders_total_nonnegative CHECK (total >= 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_positive CHECK (quantity >= 1);
ALTER TABLE order_items ADD CONSTRAINT order_items_unit_price_nonnegative CHECK (unit_price >= 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_discount_nonnegative CHECK (line_discount >= 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_total_nonnegative CHECK (line_total >= 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_order_product_key UNIQUE (order_id, product_id);
ALTER TABLE order_events ADD CONSTRAINT order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_user_product_key UNIQUE (user_id, product_id);
ALTER TABLE signup_authorizations ADD CONSTRAINT signup_authorizations_hashes_nonempty CHECK (token_hash <> '' AND email_hash <> '');
