CREATE OR REPLACE FUNCTION assign_product_sku()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN NEW.sku := generate_sku(); END IF;
  NEW.sku := upper(NEW.sku);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reject_order_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'order_events are immutable' USING ERRCODE = 'check_violation';
END;
$$;

CREATE OR REPLACE FUNCTION enforce_review_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id <> auth.uid() OR NOT can_review_product(NEW.product_id) THEN
    RAISE EXCEPTION 'review requires a delivered purchase by its author' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_brands_updated_at ON brands;
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_products_assign_sku ON products;
CREATE TRIGGER trg_products_assign_sku BEFORE INSERT OR UPDATE OF sku ON products FOR EACH ROW EXECUTE FUNCTION assign_product_sku();
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_product_variations_updated_at ON product_variations;
CREATE TRIGGER trg_product_variations_updated_at BEFORE UPDATE ON product_variations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_product_variation_items_updated_at ON product_variation_items;
CREATE TRIGGER trg_product_variation_items_updated_at BEFORE UPDATE ON product_variation_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_offers_updated_at ON offers;
CREATE TRIGGER trg_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items;
CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_orders_status_transition ON orders;
CREATE TRIGGER trg_orders_status_transition BEFORE UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION enforce_order_status_transition();
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_product_reviews_eligibility ON product_reviews;
CREATE TRIGGER trg_product_reviews_eligibility BEFORE INSERT OR UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION enforce_review_eligibility();
DROP TRIGGER IF EXISTS trg_product_reviews_moderation ON product_reviews;
CREATE TRIGGER trg_product_reviews_moderation BEFORE INSERT OR UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION stamp_review_moderation();
DROP TRIGGER IF EXISTS trg_product_reviews_updated_at ON product_reviews;
CREATE TRIGGER trg_product_reviews_updated_at BEFORE UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_order_events_immutable ON order_events;
CREATE TRIGGER trg_order_events_immutable BEFORE UPDATE OR DELETE ON order_events FOR EACH ROW EXECUTE FUNCTION reject_order_event_mutation();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
