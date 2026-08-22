-- Idempotent migration: product_group_items → product_variations + product_variation_items
--
-- A variation is a relationship container that lets the product-detail page
-- present several existing products as selectable alternatives.
-- Every product remains an independent products row.

-- ── 0. Ensure set_updated_at exists ───────────────────────────────────

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

-- ── 1. Create new tables (if not exists) ──────────────────────────────

CREATE TABLE IF NOT EXISTS product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_variation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_id uuid NOT NULL,
  product_id uuid NOT NULL,
  option_label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Add constraints (idempotent) ──────────────────────────────────

DO $$ BEGIN
  ALTER TABLE product_variation_items
    ADD CONSTRAINT product_variation_items_variation_id_fkey
    FOREIGN KEY (variation_id) REFERENCES product_variations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE product_variation_items
    ADD CONSTRAINT product_variation_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE product_variation_items
    ADD CONSTRAINT product_variation_items_position_nonnegative
    CHECK (position >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE product_variation_items
    ADD CONSTRAINT product_variation_items_variation_product_key
    UNIQUE (variation_id, product_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE product_variation_items
    ADD CONSTRAINT product_variation_items_variation_position_key
    UNIQUE (variation_id, position);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE product_variation_items
    ADD CONSTRAINT product_variation_items_option_label_nonempty
    CHECK (option_label <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Indexes (idempotent) ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS product_variation_items_variation_position_idx ON product_variation_items (variation_id, position);
CREATE INDEX IF NOT EXISTS product_variation_items_product_idx ON product_variation_items (product_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────

ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_variations_public_read ON product_variations;
CREATE POLICY product_variations_public_read ON product_variations FOR SELECT USING (true);

DROP POLICY IF EXISTS product_variation_items_public_read ON product_variation_items;
CREATE POLICY product_variation_items_public_read ON product_variation_items FOR SELECT USING (true);

-- ── 5. Grants ─────────────────────────────────────────────────────────

GRANT SELECT ON product_variations TO anon, authenticated;
GRANT SELECT ON product_variation_items TO anon, authenticated;
GRANT ALL ON product_variations TO service_role;
GRANT ALL ON product_variation_items TO service_role;

-- ── 6. Triggers ───────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_product_variations_updated_at ON product_variations;
CREATE TRIGGER trg_product_variations_updated_at
  BEFORE UPDATE ON product_variations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_product_variation_items_updated_at ON product_variation_items;
CREATE TRIGGER trg_product_variation_items_updated_at
  BEFORE UPDATE ON product_variation_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 7. Migrate data (only if old table exists and new tables are empty) ─

DO $$
DECLARE
  grp RECORD;
  new_vid uuid;
  child RECORD;
  label_val text;
  child_pos integer;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_group_items')
     AND NOT EXISTS (SELECT 1 FROM product_variation_items LIMIT 1) THEN

    FOR grp IN SELECT DISTINCT group_id FROM product_group_items ORDER BY group_id LOOP
      -- Create a variation for this group
      INSERT INTO product_variations (id) VALUES (gen_random_uuid()) RETURNING id INTO new_vid;

      -- Add the group_id product (the parent/base product) at position 0
      INSERT INTO product_variation_items (variation_id, product_id, option_label, position)
      SELECT new_vid, grp.group_id, p.name, 0
      FROM products p WHERE p.id = grp.group_id;

      -- Add each child product at position 1, 2, 3, ...
      child_pos := 1;
      FOR child IN
        SELECT pgi.product_id, pgi.variation_attributes, p.name
        FROM product_group_items pgi
        JOIN products p ON p.id = pgi.product_id
        WHERE pgi.group_id = grp.group_id
        ORDER BY pgi.position
      LOOP
        -- Extract option label from variation_attributes values
        SELECT string_agg(value, ' / ') INTO label_val
        FROM jsonb_each_text(child.variation_attributes);

        IF label_val IS NULL OR label_val = '' THEN
          label_val := child.name;
        END IF;

        INSERT INTO product_variation_items (variation_id, product_id, option_label, position)
        VALUES (new_vid, child.product_id, label_val, child_pos);

        child_pos := child_pos + 1;
      END LOOP;
    END LOOP;

  END IF;
END $$;

-- ── 8. Remove old table (if exists) ───────────────────────────────────

DROP TABLE IF EXISTS product_group_items CASCADE;

-- ── 9. Update get_related_products function ────────────────────────────

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

NOTIFY pgrst, 'reload schema';
