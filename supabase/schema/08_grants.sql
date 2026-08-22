REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT SELECT ON categories, brands, products, product_images, product_variations, product_variation_items, offers, offer_products, product_reviews TO anon, authenticated;
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON addresses, cart_items, wishlist_items TO authenticated;
GRANT SELECT ON orders, order_items, order_events TO authenticated;
GRANT INSERT, UPDATE ON product_reviews TO authenticated;
GRANT EXECUTE ON FUNCTION can_review_product(uuid) TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION create_order(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION change_order_status(uuid, order_status_enum, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION cancel_order(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION return_order(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(text, rate_limit_dimension_enum, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION get_related_products(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION consume_signup_authorization(text, text) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION hook_validate_signup_authorization(jsonb) TO supabase_auth_admin;
