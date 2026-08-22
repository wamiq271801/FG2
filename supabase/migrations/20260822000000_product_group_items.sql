-- Idempotent migration: product_variants → product_group_items

-- Drop old triggers
DROP TRIGGER IF EXISTS trg_products_stock_invariant ON products;
DROP TRIGGER IF EXISTS trg_product_variants_invariant ON product_variants;

-- Drop old invariant functions
DROP FUNCTION IF EXISTS enforce_product_stock_invariant();
DROP FUNCTION IF EXISTS enforce_product_variant_invariant();

-- Rename table
ALTER TABLE product_variants RENAME TO product_group_items;

-- Rename column
ALTER TABLE product_group_items RENAME COLUMN parent_product_id TO group_id;

-- Drop swatch column
ALTER TABLE product_group_items DROP COLUMN swatch;

-- Remove is_family_parent
ALTER TABLE products DROP COLUMN IF EXISTS is_family_parent;

-- Make stock NOT NULL
UPDATE products SET stock = 0 WHERE stock IS NULL;
ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN stock SET NOT NULL;

-- Drop old constraints
ALTER TABLE product_group_items DROP CONSTRAINT IF EXISTS product_variants_parent_product_id_fkey;
ALTER TABLE product_group_items DROP CONSTRAINT IF EXISTS fk_product_variants_child_product_id;
ALTER TABLE product_group_items DROP CONSTRAINT IF EXISTS product_variants_no_self_reference;
ALTER TABLE product_group_items DROP CONSTRAINT IF EXISTS product_variants_attributes_object;
ALTER TABLE product_group_items DROP CONSTRAINT IF EXISTS product_variants_position_nonnegative;
ALTER TABLE product_group_items DROP CONSTRAINT IF EXISTS product_variants_parent_product_key;
ALTER TABLE product_group_items DROP CONSTRAINT IF EXISTS product_variants_parent_position_key;

-- Add new constraints
ALTER TABLE product_group_items ADD CONSTRAINT product_group_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_group_items ADD CONSTRAINT product_group_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE product_group_items ADD CONSTRAINT product_group_items_no_self_reference CHECK (group_id <> product_id);
ALTER TABLE product_group_items ADD CONSTRAINT product_group_items_attributes_object CHECK (jsonb_typeof(variation_attributes) = 'object');
ALTER TABLE product_group_items ADD CONSTRAINT product_group_items_position_nonnegative CHECK (position >= 0);
ALTER TABLE product_group_items ADD CONSTRAINT product_group_items_group_product_key UNIQUE (group_id, product_id);
ALTER TABLE product_group_items ADD CONSTRAINT product_group_items_group_position_key UNIQUE (group_id, position);

-- Drop old product constraints
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sellable_stock_required;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_family_parent_state;

-- Recreate stock constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_nonnegative;
ALTER TABLE products ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0);

-- Drop old indexes
DROP INDEX IF EXISTS product_variants_parent_position_idx;
DROP INDEX IF EXISTS product_variants_product_idx;

-- Create new indexes
CREATE INDEX IF NOT EXISTS product_group_items_group_position_idx ON product_group_items (group_id, position);
CREATE INDEX IF NOT EXISTS product_group_items_product_idx ON product_group_items (product_id);

-- Update purchasable index
DROP INDEX IF EXISTS products_purchasable_idx;
CREATE INDEX products_purchasable_idx ON products (category_id, brand_id, price) WHERE is_active AND stock > 0;

-- Update RLS policy
DROP POLICY IF EXISTS product_variants_public_read ON product_variants;
DROP POLICY IF EXISTS product_group_items_public_read ON product_group_items;
CREATE POLICY product_group_items_public_read ON product_group_items FOR SELECT USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_group_items.product_id AND p.is_active));

-- Update grants
REVOKE SELECT ON product_variants FROM anon, authenticated;
REVOKE SELECT ON product_group_items FROM anon, authenticated;
GRANT SELECT ON product_group_items TO anon, authenticated;

-- Recreate updated_at trigger
DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
DROP TRIGGER IF EXISTS trg_product_group_items_updated_at ON product_group_items;
CREATE TRIGGER trg_product_group_items_updated_at BEFORE UPDATE ON product_group_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Update get_related_products function
CREATE OR REPLACE FUNCTION get_related_products(p_product_id uuid, p_limit integer DEFAULT 6)
RETURNS TABLE (product_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH source AS (
    SELECT * FROM products WHERE id = p_product_id
  ), source_group AS (
    SELECT group_id FROM product_group_items WHERE product_id = p_product_id
  ), group_siblings AS (
    SELECT product_id FROM product_group_items WHERE group_id = (SELECT group_id FROM source_group)
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
      AND p.id NOT IN (SELECT product_id FROM group_siblings)
  ), diversified AS (
    SELECT id, score, row_number() OVER (PARTITION BY brand_id ORDER BY score DESC, id) AS brand_rank FROM candidates
  )
  SELECT id FROM diversified ORDER BY brand_rank, score DESC, id LIMIT greatest(least(p_limit, 8), 4);
$$;

NOTIFY pgrst, 'reload schema';
