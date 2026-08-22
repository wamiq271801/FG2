CREATE SEQUENCE IF NOT EXISTS order_number_seq;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_sku()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_sku text;
BEGIN
  LOOP
    v_sku := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM products WHERE sku = v_sku);
  END LOOP;
  RETURN v_sku;
END;
$$;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'FG-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 8, '0');
$$;

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

CREATE OR REPLACE FUNCTION consume_signup_authorization(p_email_hash text, p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE signup_authorizations
  SET consumed_at = now()
  WHERE token_hash = p_token_hash
    AND email_hash = p_email_hash
    AND expires_at > now()
    AND consumed_at IS NULL
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION hook_validate_signup_authorization(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email text := event->'user'->>'email';
  v_token text := event->'user'->'user_metadata'->>'reg_auth';
  v_allowed boolean;
BEGIN
  IF coalesce(v_email, '') = '' OR coalesce(v_token, '') = '' THEN
    RETURN jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Signup is not authorized.'));
  END IF;
  SELECT consume_signup_authorization(
    encode(extensions.digest(lower(trim(v_email)), 'sha256'), 'hex'),
    encode(extensions.digest(v_token, 'sha256'), 'hex')
  ) INTO v_allowed;
  IF v_allowed THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Your registration session expired. Please submit the form again.'));
END;
$$;

CREATE OR REPLACE FUNCTION can_review_product(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = auth.uid()
         AND o.status = 'delivered'
         AND oi.product_id = p_product_id
     );
$$;

CREATE OR REPLACE FUNCTION is_legal_order_transition(p_from order_status_enum, p_to order_status_enum)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (p_from, p_to) IN (
    ('processing', 'confirmed'),
    ('confirmed', 'shipped'),
    ('shipped', 'out-for-delivery'),
    ('out-for-delivery', 'delivered'),
    ('processing', 'cancelled'),
    ('confirmed', 'cancelled'),
    ('delivered', 'returned')
  );
$$;

CREATE OR REPLACE FUNCTION enforce_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> OLD.status AND NOT is_legal_order_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'illegal order status transition: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_action text,
  p_dimension rate_limit_dimension_enum,
  p_subject_hash text,
  p_max integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_action = '' OR p_subject_hash = '' OR p_max < 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'invalid rate-limit request' USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM worker_rate_limits
  WHERE action = p_action AND dimension = p_dimension AND subject_hash = p_subject_hash
    AND created_at < now() - make_interval(secs => p_window_seconds);
  INSERT INTO worker_rate_limits (action, dimension, subject_hash)
  VALUES (p_action, p_dimension, p_subject_hash);
  SELECT count(*) INTO v_count FROM worker_rate_limits
  WHERE action = p_action AND dimension = p_dimension AND subject_hash = p_subject_hash
    AND created_at >= now() - make_interval(secs => p_window_seconds);
  RETURN v_count <= p_max;
END;
$$;

CREATE OR REPLACE FUNCTION create_order(
  p_user_id uuid,
  p_address_id uuid,
  p_idempotency_key text,
  p_expected_total integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request_hash text := encode(extensions.digest(p_address_id::text || '|' || coalesce(p_expected_total::text, ''), 'sha256'), 'hex');
  v_existing orders%ROWTYPE;
  v_address addresses%ROWTYPE;
  v_item record;
  v_product products%ROWTYPE;
  v_order_id uuid := gen_random_uuid();
  v_subtotal integer := 0;
  v_discount_total integer := 0;
  v_shipping_total integer;
  v_total integer;
  v_line_discount integer;
  v_line_total integer;
BEGIN
  IF coalesce(trim(p_idempotency_key), '') = '' THEN
    RETURN jsonb_build_object('error', 'INVALID_IDEMPOTENCY_KEY');
  END IF;
  SELECT * INTO v_existing FROM orders
  WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.idempotency_request_hash <> v_request_hash THEN
      RETURN jsonb_build_object('error', 'IDEMPOTENCY_KEY_REUSED');
    END IF;
    RETURN jsonb_build_object('orderId', v_existing.id, 'orderNumber', v_existing.order_number, 'total', v_existing.total, 'idempotent', true);
  END IF;

  SELECT * INTO v_address FROM addresses WHERE id = p_address_id AND user_id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'ADDRESS_NOT_FOUND'); END IF;
  IF NOT EXISTS (SELECT 1 FROM cart_items WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('error', 'CART_EMPTY');
  END IF;

  FOR v_item IN SELECT product_id, quantity FROM cart_items WHERE user_id = p_user_id ORDER BY product_id FOR UPDATE LOOP
    SELECT * INTO v_product FROM products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND OR NOT v_product.is_active THEN
      RETURN jsonb_build_object('error', 'PRODUCT_UNAVAILABLE', 'productId', v_item.product_id);
    END IF;
    IF v_product.stock IS NULL THEN
      RETURN jsonb_build_object('error', 'PRODUCT_NOT_PURCHASABLE', 'productId', v_item.product_id);
    END IF;
    IF NOT v_product.is_preorder AND v_product.stock < v_item.quantity THEN
      RETURN jsonb_build_object('error', 'OUT_OF_STOCK', 'name', v_product.name, 'stock', v_product.stock, 'requested', v_item.quantity);
    END IF;
    v_line_discount := CASE WHEN v_product.compare_at_price IS NOT NULL THEN (v_product.compare_at_price - v_product.price) * v_item.quantity ELSE 0 END;
    v_line_total := v_product.price * v_item.quantity;
    v_subtotal := v_subtotal + v_line_total;
    v_discount_total := v_discount_total + v_line_discount;
  END LOOP;

  v_shipping_total := CASE WHEN v_subtotal - v_discount_total >= 4990 THEN 0 ELSE 149 END;
  v_total := v_subtotal - v_discount_total + v_shipping_total;
  IF p_expected_total IS NOT NULL AND p_expected_total <> v_total THEN
    RETURN jsonb_build_object('error', 'ORDER_PRICE_CHANGED', 'expectedTotal', p_expected_total, 'actualTotal', v_total, 'subtotal', v_subtotal, 'discountTotal', v_discount_total, 'shippingTotal', v_shipping_total);
  END IF;

  INSERT INTO orders (id, order_number, user_id, subtotal, discount_total, shipping_total, tax_total, total, ship_label, ship_line1, ship_line2, ship_city, ship_state, ship_postcode, ship_country, ship_phone, estimated_delivery, idempotency_key, idempotency_request_hash)
  VALUES (v_order_id, generate_order_number(), p_user_id, v_subtotal, v_discount_total, v_shipping_total, 0, v_total, v_address.label, v_address.line1, v_address.line2, v_address.city, v_address.state, v_address.postcode, v_address.country, v_address.phone, (now() + interval '4 days')::date, p_idempotency_key, v_request_hash);

  FOR v_item IN SELECT ci.product_id, ci.quantity, p.name, p.sku, p.visual_key, p.accent, p.price, p.compare_at_price, p.is_preorder FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = p_user_id ORDER BY ci.product_id LOOP
    v_line_discount := CASE WHEN v_item.compare_at_price IS NOT NULL THEN (v_item.compare_at_price - v_item.price) * v_item.quantity ELSE 0 END;
    v_line_total := v_item.price * v_item.quantity;
    INSERT INTO order_items (order_id, product_id, product_name, product_sku, visual_key, accent, quantity, unit_price, line_discount, line_total)
    VALUES (v_order_id, v_item.product_id, v_item.name, v_item.sku, v_item.visual_key, v_item.accent, v_item.quantity, v_item.price, v_line_discount, v_line_total);
    IF NOT v_item.is_preorder THEN
      UPDATE products SET stock = stock - v_item.quantity WHERE id = v_item.product_id;
    END IF;
  END LOOP;
  INSERT INTO order_events (order_id, event_type) VALUES (v_order_id, 'order_created');
  DELETE FROM cart_items WHERE user_id = p_user_id;
  RETURN jsonb_build_object('orderId', v_order_id, 'orderNumber', (SELECT order_number FROM orders WHERE id = v_order_id), 'total', v_total, 'subtotal', v_subtotal, 'discountTotal', v_discount_total, 'shippingTotal', v_shipping_total, 'idempotent', false);
END;
$$;

CREATE OR REPLACE FUNCTION change_order_status(p_order_id uuid, p_new_status order_status_enum, p_metadata jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_previous order_status_enum;
BEGIN
  SELECT status INTO v_previous FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'ORDER_NOT_FOUND'); END IF;
  IF NOT is_legal_order_transition(v_previous, p_new_status) THEN
    RETURN jsonb_build_object('error', 'ILLEGAL_TRANSITION', 'from', v_previous, 'to', p_new_status);
  END IF;
  UPDATE orders SET status = p_new_status WHERE id = p_order_id;
  INSERT INTO order_events (order_id, event_type, metadata) VALUES (p_order_id, replace(p_new_status::text, '-', '_'), p_metadata);
  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'status', p_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION cancel_order(p_order_id uuid, p_metadata jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status order_status_enum; v_item record;
BEGIN
  SELECT status INTO v_status FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'ORDER_NOT_FOUND'); END IF;
  IF v_status NOT IN ('processing', 'confirmed') THEN RETURN jsonb_build_object('error', 'CANNOT_CANCEL', 'status', v_status); END IF;
  FOR v_item IN SELECT oi.product_id, oi.quantity, p.is_preorder FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = p_order_id ORDER BY oi.product_id FOR UPDATE OF p LOOP
    IF NOT v_item.is_preorder THEN UPDATE products SET stock = stock + v_item.quantity WHERE id = v_item.product_id; END IF;
  END LOOP;
  UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;
  INSERT INTO order_events (order_id, event_type, metadata) VALUES (p_order_id, 'cancelled', p_metadata);
  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION return_order(p_order_id uuid, p_metadata jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status order_status_enum;
BEGIN
  SELECT status INTO v_status FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'ORDER_NOT_FOUND'); END IF;
  IF v_status <> 'delivered' THEN RETURN jsonb_build_object('error', 'CANNOT_RETURN', 'status', v_status); END IF;
  UPDATE orders SET status = 'returned' WHERE id = p_order_id;
  INSERT INTO order_events (order_id, event_type, metadata) VALUES (p_order_id, 'returned', p_metadata);
  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'status', 'returned');
END;
$$;

CREATE OR REPLACE FUNCTION get_related_products(p_product_id uuid, p_limit integer DEFAULT 6)
RETURNS TABLE (product_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH source AS (
    SELECT * FROM products WHERE id = p_product_id
  ), source_variation AS (
    SELECT pvi.variation_id FROM product_variation_items pvi WHERE pvi.product_id = p_product_id
  ), variation_siblings AS (
    SELECT pvi.product_id FROM product_variation_items pvi WHERE pvi.variation_id = (SELECT variation_id FROM source_variation)
  ), candidates AS (
    SELECT p.id, p.brand_id,
      (CASE WHEN p.category_id = s.category_id THEN 100 ELSE 0 END) +
      (CASE WHEN p.subcategory IS NOT NULL AND p.subcategory = s.subcategory THEN 30 ELSE 0 END) +
      (CASE WHEN p.brand_id = s.brand_id THEN 15 ELSE 0 END) +
      (CASE WHEN p.specs <> '[]'::jsonb AND s.specs <> '[]'::jsonb AND p.specs @> s.specs THEN 10 ELSE 0 END) -
      least(abs(p.price - s.price) / greatest(s.price, 1), 20) AS score
    FROM products p CROSS JOIN source s
    WHERE p.id <> s.id AND p.is_active AND p.stock > 0
      AND (p.is_preorder OR p.stock > 0)
      AND p.category_id = s.category_id
      AND p.id NOT IN (SELECT product_id FROM variation_siblings)
  ), diversified AS (
    SELECT id, score, row_number() OVER (PARTITION BY brand_id ORDER BY score DESC, id) AS brand_rank FROM candidates
  )
  SELECT id FROM diversified ORDER BY brand_rank, score DESC, id LIMIT greatest(least(p_limit, 8), 4);
$$;
