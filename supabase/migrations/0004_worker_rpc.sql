-- Phase: Worker Rate Limiting + Order RPC
-- Run in Supabase Dashboard SQL Editor.

-- 1. Rate limit table + atomic check function
CREATE TABLE IF NOT EXISTS worker_rate_limits (
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_time ON worker_rate_limits(key, created_at);

CREATE OR REPLACE FUNCTION check_rate_limit(p_key text, p_max int, p_window_seconds int)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM worker_rate_limits
  WHERE key = p_key AND created_at < now() - (p_window_seconds || ' seconds')::interval;
  INSERT INTO worker_rate_limits (key) VALUES (p_key);
  SELECT count(*) <= p_max FROM worker_rate_limits WHERE key = p_key;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit(text, int, int) TO anon, authenticated;

-- 2. Transactional order creation RPC
CREATE OR REPLACE FUNCTION create_order(
  p_user_id uuid,
  p_address_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id text;
  v_addr RECORD;
  v_cart_item RECORD;
  v_product RECORD;
  v_variant RECORD;
  v_unit_price int;
  v_variant_name text;
  v_line_discount int;
  v_line_total int;
  v_subtotal int := 0;
  v_discount_total int := 0;
  v_shipping_total int;
  v_total int;
  v_existing_order text;
BEGIN
  -- Idempotency check
  SELECT id INTO v_existing_order FROM orders
  WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing_order IS NOT NULL THEN
    RETURN jsonb_build_object('orderId', v_existing_order, 'idempotent', true);
  END IF;

  -- Verify address ownership
  SELECT * INTO v_addr FROM addresses WHERE id = p_address_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ADDRESS_NOT_FOUND');
  END IF;

  -- Generate order ID
  v_order_id := 'FG-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD((floor(random() * 9000) + 1000)::text, 4, '0');

  -- Compute totals from cart
  FOR v_cart_item IN
    SELECT product_slug, variant_id, quantity FROM cart_items WHERE user_id = p_user_id
  LOOP
    SELECT * INTO v_product FROM products WHERE slug = v_cart_item.product_slug AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'PRODUCT_UNAVAILABLE', 'slug', v_cart_item.product_slug);
    END IF;
    IF v_product.availability = 'out-of-stock' THEN
      RETURN jsonb_build_object('error', 'OUT_OF_STOCK', 'name', v_product.name);
    END IF;

    v_unit_price := v_product.price;
    v_variant_name := NULL;
    IF v_cart_item.variant_id != '' THEN
      SELECT * INTO v_variant FROM product_variants
      WHERE product_slug = v_cart_item.product_slug AND variant_id = v_cart_item.variant_id;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'VARIANT_UNAVAILABLE', 'slug', v_cart_item.product_slug);
      END IF;
      IF NOT v_variant.in_stock THEN
        RETURN jsonb_build_object('error', 'VARIANT_OUT_OF_STOCK', 'name', v_product.name, 'variant', v_variant.name);
      END IF;
      v_unit_price := v_product.price + v_variant.price_delta;
      v_variant_name := v_variant.name;
    END IF;

    v_line_discount := CASE
      WHEN v_product.compare_at IS NOT NULL AND v_product.compare_at > v_product.price
      THEN (v_product.compare_at - v_product.price) * v_cart_item.quantity
      ELSE 0
    END;
    v_line_total := v_unit_price * v_cart_item.quantity;
    v_subtotal := v_subtotal + v_line_total;
    v_discount_total := v_discount_total + v_line_discount;

    INSERT INTO order_items (
      order_id, product_slug, product_name, variant_name,
      visual_key, accent, quantity, unit_price, line_discount, line_total
    ) VALUES (
      v_order_id, v_product.slug, v_product.name, v_variant_name,
      v_product.visual_key, v_product.accent, v_cart_item.quantity,
      v_unit_price, v_line_discount, v_line_total
    );
  END LOOP;

  IF v_subtotal = 0 THEN
    RETURN jsonb_build_object('error', 'CART_EMPTY');
  END IF;

  v_shipping_total := CASE WHEN v_subtotal - v_discount_total >= 4990 THEN 0 ELSE 149 END;
  v_total := v_subtotal - v_discount_total + v_shipping_total;

  -- Insert order (idempotency enforced by unique index on user_id + idempotency_key)
  BEGIN
    INSERT INTO orders (
      id, user_id, status, payment_method, payment_status, currency,
      subtotal, discount_total, shipping_total, tax_total, total,
      ship_label, ship_line1, ship_line2, ship_city, ship_state, ship_postcode, ship_country, ship_phone,
      estimated_delivery, idempotency_key
    ) VALUES (
      v_order_id, p_user_id, 'processing', 'cod', 'pending', 'INR',
      v_subtotal, v_discount_total, v_shipping_total, 0, v_total,
      v_addr.label, v_addr.line1, v_addr.line2, v_addr.city, v_addr.state, v_addr.postcode, v_addr.country, v_addr.phone,
      (now() + interval '4 days')::date, p_idempotency_key
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing_order FROM orders
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
    RETURN jsonb_build_object('orderId', v_existing_order, 'idempotent', true);
  END;

  -- Insert timeline
  INSERT INTO order_timeline (order_id, step_label, step_date, step_index, done) VALUES
    (v_order_id, 'Order placed', now(), 0, true),
    (v_order_id, 'Packed', NULL, 1, false),
    (v_order_id, 'Shipped', NULL, 2, false),
    (v_order_id, 'Out for delivery', NULL, 3, false),
    (v_order_id, 'Delivered', NULL, 4, false);

  -- Clear ordered cart items
  DELETE FROM cart_items WHERE user_id = p_user_id;

  RETURN jsonb_build_object('orderId', v_order_id, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION create_order(uuid, uuid, text) TO authenticated;
