#!/usr/bin/env python3
"""
Parse old seed.sql + seed-auth.sql and generate a new seed.sql
compatible with the CURRENT database schema.

Current schema tables:
  brands, categories, products (with highlights[], includes[], specs jsonb,
  is_family_parent, is_preorder, stock NOT NULL), product_images,
  product_variants (parent_product_id, product_id, variation_attributes jsonb, swatch, position),
  offers, offer_products, profiles, addresses, orders, order_items,
  order_events (was order_timeline), product_reviews

NOT in current schema (skip):
  product_highlights, product_specs, product_includes, product_badges,
  product_related, order_timeline, circulation_entries, circulation_versions
"""

import re
import uuid
from collections import defaultdict

NS = uuid.UUID("00000000-0000-0000-0000-f00000000000")

def make_uuid(*parts):
    """Deterministic UUID from string parts."""
    key = "|".join(str(p) for p in parts)
    return str(uuid.uuid5(NS, key))

# ── parse old seed ──────────────────────────────────────────────
def split_sql_values(s):
    """Split a SQL VALUES argument list into individual values, respecting quotes and parens."""
    values = []
    current = ""
    depth = 0
    bracket_depth = 0
    in_quote = False
    i = 0
    while i < len(s):
        ch = s[i]
        if in_quote:
            current += ch
            if ch == "'" and i + 1 < len(s) and s[i + 1] == "'":
                current += s[i + 1]
                i += 2
                continue
            elif ch == "'":
                in_quote = False
        else:
            if ch == "'":
                in_quote = True
                current += ch
            elif ch == "[":
                bracket_depth += 1
                current += ch
            elif ch == "]":
                bracket_depth -= 1
                current += ch
            elif ch == "(":
                depth += 1
                current += ch
            elif ch == ")":
                depth -= 1
                current += ch
            elif ch == "," and depth == 0 and bracket_depth == 0:
                values.append(current.strip())
                current = ""
            else:
                current += ch
        i += 1
    if current.strip():
        values.append(current.strip())
    return values


def parse_value(v):
    """Parse a single SQL value string into a Python value."""
    v = v.strip()
    if v.upper() == "NULL":
        return None
    if v.lower() == "now()":
        return ("EXPRESSION", "now()")
    if v.lower() == "current_date":
        return ("EXPRESSION", "CURRENT_DATE")
    if v.upper().startswith("CRYPT("):
        return ("EXPRESSION", v)
    if v.upper().startswith("ARRAY["):
        return ("ARRAY", v)
    if v.startswith("(") and "interval" in v.lower():
        return ("EXPRESSION", v)
    if v.startswith("'") and v.endswith("'"):
        return v[1:-1].replace("''", "'")
    if v.startswith("'") and "::" in v:
        return ("EXPRESSION", v)
    if v.startswith("'"):
        # unclosed quote — likely spanned multiple lines; return as-is
        return v
    return v


def parse_insert(sql):
    """Parse a single INSERT INTO ... VALUES (...) returning (table, columns, rows)."""
    # Handle multi-row INSERTs: INSERT INTO t (cols) VALUES (row1), (row2), ...
    m = re.match(
        r"INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*(.+)",
        sql.strip(),
        re.IGNORECASE | re.DOTALL,
    )
    if not m:
        return None, None, None
    table = m.group(1)
    cols = [c.strip() for c in m.group(2).split(",")]
    raw_rows = m.group(3)
    # strip trailing ON CONFLICT etc
    raw_rows = re.sub(r"\s+ON\s+CONFLICT.*$", "", raw_rows, flags=re.IGNORECASE).strip()
    raw_rows = re.sub(r"\s*;\s*$", "", raw_rows).strip()

    # Split into individual row tuples: (val1, val2, ...), (val1, val2, ...)
    rows = []
    # Find each (...) block
    i = 0
    while i < len(raw_rows):
        # skip to next '('
        idx = raw_rows.find("(", i)
        if idx == -1:
            break
        # find matching ')'
        depth = 1
        j = idx + 1
        in_q = False
        while j < len(raw_rows) and depth > 0:
            c = raw_rows[j]
            if in_q:
                if c == "'" and j + 1 < len(raw_rows) and raw_rows[j + 1] == "'":
                    j += 2
                    continue
                if c == "'":
                    in_q = False
            else:
                if c == "'":
                    in_q = True
                elif c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
            j += 1
        if depth != 0:
            break
        row_content = raw_rows[idx + 1 : j - 1]
        vals = split_sql_values(row_content)
        parsed = [parse_value(v) for v in vals]
        rows.append(parsed)
        i = j
    return table, cols, rows

def read_seed(path):
    """Read seed file and return list of (table, columns, rows) tuples."""
    with open(path) as f:
        text = f.read()
    # remove comments
    text = re.sub(r"--[^\n]*", "", text)
    results = []
    for sql in re.split(r";\s*\n", text):
        sql = sql.strip()
        if not sql or sql.upper() in ("BEGIN", "COMMIT"):
            continue
        table, cols, rows = parse_insert(sql + ";")
        if table and rows:
            for row in rows:
                results.append((table, cols, row))
    return results

def row_to_dict(cols, row):
    d = {}
    for i, c in enumerate(cols):
        d[c] = row[i] if i < len(row) else None
    return d

# ── main ────────────────────────────────────────────────────────
def main():
    records = read_seed("seed.sql")
    auth_records = read_seed("seed-auth.sql")

    # Group by table
    by_table = defaultdict(list)
    for table, cols, row in records:
        by_table[table].append(row_to_dict(cols, row))

    for table, cols, row in auth_records:
        by_table[table].append(row_to_dict(cols, row))

    # parse offer_products SELECT-based inserts manually
    with open("seed.sql") as f:
        seed_text = f.read()
    seed_text_no_comments = re.sub(r"--[^\n]*", "", seed_text)
    for m in re.finditer(
        r"INSERT\s+INTO\s+offer_products\s*\(offer_id,product_slug,position\)\s*SELECT\s+id,'([^']+)',(\d+)\s+FROM\s+offers\s+WHERE\s+slug='([^']+)'",
        seed_text_no_comments,
        re.IGNORECASE,
    ):
        product_slug = m.group(1)
        position = int(m.group(2))
        offer_slug = m.group(3)
        by_table["offer_products"].append({
            "offer_slug": offer_slug,
            "product_slug": product_slug,
            "position": position,
        })

    # ── brands ──────────────────────────────────────────────
    brand_slug_id = {}
    brand_rows = []
    for r in by_table.get("brands", []):
        bid = make_uuid("brand", r["slug"])
        brand_slug_id[r["slug"]] = bid
        brand_rows.append((bid, r["slug"], r["name"], r["country"], r["blurb"]))

    # ── categories ──────────────────────────────────────────
    cat_slug_id = {}
    cat_rows = []
    for r in by_table.get("categories", []):
        cid = make_uuid("category", r["slug"])
        cat_slug_id[r["slug"]] = cid
        # current schema has: slug, name, tagline, description, intro, image, accent, subcategories, seo_note
        # old seed has 'featured' which current schema does NOT have
        subcats = r.get("subcategories")
        if isinstance(subcats, tuple) and subcats[0] == "ARRAY":
            subcats_val = subcats[1]  # keep as raw SQL expression
        else:
            subcats_val = "'{}'::text[]"
        cat_rows.append((cid, r["slug"], r["name"], r["tagline"],
                         r["description"], r["intro"], r["image"], r["accent"],
                         subcats_val, r.get("seo_note")))

    # ── specs / highlights / includes aggregation ────────────
    specs_agg = defaultdict(list)  # product_slug → [(label, value, pos)]
    highlights_agg = defaultdict(list)  # product_slug → [(body, pos)]
    includes_agg = defaultdict(list)  # product_slug → [(body, pos)]

    for r in by_table.get("product_specs", []):
        pos = r.get("position") or r.get("position", 0)
        specs_agg[r["product_slug"]].append((r.get("label", ""), r.get("value", ""), int(pos) if pos is not None else 0))
    for r in by_table.get("product_highlights", []):
        pos = r.get("position") or 0
        highlights_agg[r["product_slug"]].append((r.get("body", ""), int(pos) if pos is not None else 0))
    for r in by_table.get("product_includes", []):
        pos = r.get("position") or 0
        includes_agg[r["product_slug"]].append((r.get("body", ""), int(pos) if pos is not None else 0))

    def build_specs_json(slug):
        items = sorted(specs_agg.get(slug, []), key=lambda x: x[2])
        if not items:
            return "'[]'::jsonb"
        parts = []
        for label, value, _ in items:
            label_escaped = label.replace('"', '\\"').replace("'", "''")
            value_escaped = value.replace('"', '\\"').replace("'", "''")
            parts.append(f'{{"label":"{label_escaped}","value":"{value_escaped}"}}')
        arr = ",".join(parts)
        return f"'[{arr}]'::jsonb"

    def build_highlights_array(slug):
        items = sorted(highlights_agg.get(slug, []), key=lambda x: x[1])
        if not items:
            return "'{}'::text[]"
        vals = ",".join(f"'{b[0].replace(chr(39), chr(39)+chr(39))}'" for b in items)
        return f"ARRAY[{vals}]::text[]"

    def build_includes_array(slug):
        items = sorted(includes_agg.get(slug, []), key=lambda x: x[1])
        if not items:
            return "'{}'::text[]"
        vals = ",".join(f"'{b[0].replace(chr(39), chr(39)+chr(39))}'" for b in items)
        return f"ARRAY[{vals}]::text[]"

    # ── parse variant data ──────────────────────────────────
    variant_groups = defaultdict(list)  # parent_slug → [variant_dicts]
    for r in by_table.get("product_variants", []):
        variant_groups[r["product_slug"]].append(r)

    # ── products ────────────────────────────────────────────
    product_rows = []  # (id, sku, slug, name, ...)
    product_slug_id = {}
    product_slug_data = {}
    variant_slug_id = {}

    # Map availability to stock + is_preorder
    def avail_to_stock(availability, old_stock):
        if availability == "preorder":
            return 0, True
        if availability == "out-of-stock":
            return 0, False
        # in-stock / low-stock: use the actual stock number
        try:
            return int(old_stock), False
        except (TypeError, ValueError):
            return 0, False

    # Process parent products
    for r in by_table.get("products", []):
        slug = r["slug"]
        pid = make_uuid("product", slug)
        product_slug_id[slug] = pid
        product_slug_data[slug] = r

        brand_id = brand_slug_id.get(r.get("brand_slug", ""), make_uuid("brand", r.get("brand_slug", "")))
        cat_id = cat_slug_id.get(r.get("category_slug", ""), make_uuid("category", r.get("category_slug", "")))
        has_variants = slug in variant_groups
        stock, is_preorder = avail_to_stock(r.get("availability"), r.get("stock"))
        sku = (r.get("sku") or slug.upper().replace("-", "")[:10])[:10]

        # story might be 'undefined' string — treat as empty
        story = r.get("story") or ""
        if story == "undefined":
            story = ""

        product_rows.append({
            "id": pid,
            "sku": sku,
            "slug": slug,
            "name": r["name"],
            "subtitle": r.get("subtitle", ""),
            "brand_id": brand_id,
            "category_id": cat_id,
            "subcategory": r.get("subcategory"),
            "tagline": r.get("tagline", ""),
            "description": r.get("description", ""),
            "story": story,
            "price": int(r["price"]),
            "compare_at_price": int(r["compare_at"]) if r.get("compare_at") else None,
            "currency": r.get("currency", "INR"),
            "visual_key": r.get("visual_key", ""),
            "accent": r.get("accent", ""),
            "stock": stock,
            "is_family_parent": has_variants,
            "is_active": r.get("is_active", "true").lower() == "true" if isinstance(r.get("is_active"), str) else bool(r.get("is_active", True)),
            "is_preorder": is_preorder,
            "variation_attributes": "'{}'::jsonb",
            "highlights": build_highlights_array(slug),
            "includes": build_includes_array(slug),
            "specs": build_specs_json(slug),
            "rating": float(r.get("rating", 0)),
            "review_count": int(r.get("review_count", 0)),
            "shipping": r.get("shipping", ""),
            "warranty": r.get("warranty", ""),
            "added_at": r.get("added_at", "CURRENT_DATE"),
        })

    # Process variant child products
    variant_rows = []  # (id, parent_product_id, product_id, variation_attributes, swatch, position)
    for parent_slug, variants in variant_groups.items():
        parent_id = product_slug_id[parent_slug]
        parent_data = product_slug_data[parent_slug]
        for v in variants:
            vslug = f"{parent_slug}-{v['variant_id']}"
            vid = make_uuid("product", vslug)
            variant_slug_id[vslug] = vid
            product_slug_id[vslug] = vid  # so order_items can resolve

            # variant child gets parent's data + variant-specific overrides
            vname = f"{parent_data['name']} — {v['name']}"
            vprice_delta = int(float(v.get("price_delta", 0)))
            vprice = int(parent_data["price"]) + vprice_delta
            vstock = 10 if v.get("in_stock", "true") in ("true", True) else 0
            vsku = f"{(parent_data.get('sku') or parent_slug.upper().replace('-', ''))[:6]}{v['variant_id'].upper()[:4]}"
            story = parent_data.get("story") or ""
            if story == "undefined":
                story = ""

            vattr_color = v["name"].replace('"', '\\"')
            vattrs = '{"Color":"' + vattr_color + '"}'

            brand_id = brand_slug_id.get(parent_data.get("brand_slug", ""), make_uuid("brand", parent_data.get("brand_slug", "")))
            cat_id = cat_slug_id.get(parent_data.get("category_slug", ""), make_uuid("category", parent_data.get("category_slug", "")))

            product_rows.append({
                "id": vid,
                "sku": vsku[:10],
                "slug": vslug,
                "name": vname,
                "subtitle": parent_data.get("subtitle", ""),
                "brand_id": brand_id,
                "category_id": cat_id,
                "subcategory": parent_data.get("subcategory"),
                "tagline": parent_data.get("tagline", ""),
                "description": parent_data.get("description", ""),
                "story": story,
                "price": vprice,
                "compare_at_price": int(parent_data["compare_at"]) if parent_data.get("compare_at") else None,
                "currency": parent_data.get("currency", "INR"),
                "visual_key": parent_data.get("visual_key", ""),
                "accent": parent_data.get("accent", ""),
                "stock": vstock,
                "is_family_parent": False,
                "is_active": True,
                "is_preorder": False,
                "variation_attributes": f"'{vattrs}'::jsonb",
                "highlights": "'{{}}'::text[]",
                "includes": "'{{}}'::text[]",
                "specs": "'[]'::jsonb",
                "rating": float(parent_data.get("rating", 0)),
                "review_count": 0,
                "shipping": parent_data.get("shipping", ""),
                "warranty": parent_data.get("warranty", ""),
                "added_at": parent_data.get("added_at", "CURRENT_DATE"),
            })

            variant_rows.append({
                "id": make_uuid("variant", parent_slug, v["variant_id"]),
                "parent_product_id": parent_id,
                "product_id": vid,
                "variation_attributes": f"'{vattrs}'::jsonb",
                "swatch": v.get("swatch"),
                "position": int(v.get("position", 0)),
            })

    # ── product_images ──────────────────────────────────────
    image_rows = []
    for r in by_table.get("product_images", []):
        pslug = r.get("product_slug", "")
        pid = product_slug_id.get(pslug)
        if pid:
            image_rows.append({
                "id": make_uuid("image", pslug, str(r.get("position", 0))),
                "product_id": pid,
                "url": r.get("url", ""),
                "position": int(r.get("position", 0)),
                "is_primary": r.get("is_primary", "false"),
            })

    # ── offers ──────────────────────────────────────────────
    offer_slug_id = {}
    offer_rows = []
    for r in by_table.get("offers", []):
        oid = make_uuid("offer", r["slug"])
        offer_slug_id[r["slug"]] = oid
        def unwrap(v):
            if isinstance(v, tuple) and len(v) == 2 and v[0] == "EXPRESSION":
                return v[1]
            return v
        offer_rows.append({
            "id": oid,
            "slug": r["slug"],
            "title": r["title"],
            "description": r.get("description", ""),
            "badge": r.get("badge", ""),
            "terms": r.get("terms", ""),
            "starts_at": unwrap(r.get("starts_at")),
            "ends_at": unwrap(r.get("ends_at")),
            "status": r.get("status", "draft"),
        })

    # ── offer_products ──────────────────────────────────────
    offer_product_rows = []
    for r in by_table.get("offer_products", []):
        offer_slug = r.get("offer_slug") or r.get("slug", "")
        # resolve offer_id via SELECT
        product_slug = r.get("product_slug", "")
        pid = product_slug_id.get(product_slug)
        if pid and offer_slug:
            offer_product_rows.append({
                "offer_slug": offer_slug,
                "product_id": pid,
                "position": int(r.get("position", 0)),
            })

    # ── profiles ────────────────────────────────────────────
    profile_rows = []
    profile_email_id = {}
    for r in by_table.get("profiles", []):
        pid = r["id"]
        profile_rows.append(r)
        profile_email_id[r["email"]] = pid

    # ── addresses ───────────────────────────────────────────
    address_rows = []
    for r in by_table.get("addresses", []):
        r["id"] = make_uuid("address", r.get("user_id", ""), r.get("label", ""))
        address_rows.append(r)

    # ── orders ──────────────────────────────────────────────
    order_text_to_uuid = {}
    order_rows = []
    for r in by_table.get("orders", []):
        old_id = r["id"]
        new_id = make_uuid("order", old_id)
        order_text_to_uuid[old_id] = new_id
        r["id"] = new_id
        order_rows.append(r)

    # ── order_items ─────────────────────────────────────────
    order_item_rows = []
    for r in by_table.get("order_items", []):
        order_uuid = order_text_to_uuid.get(r["order_id"])
        if not order_uuid:
            continue
        product_slug = r.get("product_slug", "")
        variant_name = r.get("variant_name")
        # try variant slug first, then parent
        if variant_name:
            vslug = f"{product_slug}-{variant_name.lower().replace(' ', '-')}"
            # map variant name to variant_id
            for v in by_table.get("product_variants", []):
                if v["product_slug"] == product_slug and v["name"].lower() == variant_name.lower():
                    vslug = f"{product_slug}-{v['variant_id']}"
                    break
            pid = product_slug_id.get(vslug) or product_slug_id.get(product_slug)
        else:
            pid = product_slug_id.get(product_slug)
        if not pid:
            continue
        # resolve visual_key and accent from product
        pdata = product_slug_data.get(product_slug, {})
        r2 = {
            "id": make_uuid("order-item", order_uuid, str(len(order_item_rows))),
            "order_id": order_uuid,
            "product_id": pid,
            "product_name": r.get("product_name", ""),
            "product_sku": pdata.get("sku", "") or "",
            "visual_key": r.get("visual_key", pdata.get("visual_key", "")),
            "accent": r.get("accent", pdata.get("accent", "")),
            "quantity": int(r.get("quantity", 1)),
            "unit_price": int(r.get("unit_price", 0)),
            "line_discount": int(r.get("line_discount", 0)),
            "line_total": int(r.get("line_total", 0)),
        }
        order_item_rows.append(r2)

    # ── order_events (from order_timeline) ──────────────────
    event_rows = []
    event_idx = 0
    for r in by_table.get("order_timeline", []):
        order_uuid = order_text_to_uuid.get(r.get("order_id"))
        if not order_uuid:
            continue
        event_type = r.get("step_label", "")
        step_date = r.get("step_date", "")
        step_index = r.get("step_index", 0)
        done = r.get("done", "true")
        metadata = f'{{"date":"{step_date}","step_index":{step_index},"done":{done}}}'
        event_rows.append({
            "id": make_uuid("event", order_uuid, str(event_idx)),
            "order_id": order_uuid,
            "event_type": event_type,
            "metadata": f"'{metadata}'::jsonb",
        })
        event_idx += 1

    # ── product_reviews ─────────────────────────────────────
    review_rows = []
    # default user for reviews (Riya Sharma)
    default_user_id = profile_rows[0]["id"] if profile_rows else "00000000-0000-0000-0000-000000000001"
    for r in by_table.get("product_reviews", []):
        pslug = r.get("product_slug", "")
        pid = product_slug_id.get(pslug)
        if not pid:
            continue
        review_rows.append({
            "id": make_uuid("review", pslug, str(r.get("position", 0))),
            "user_id": default_user_id,
            "product_id": pid,
            "rating": int(r.get("rating", 5)),
            "title": r.get("title", ""),
            "body": r.get("body", ""),
        })

    # ── generate SQL ────────────────────────────────────────
    lines = []
    lines.append("-- ============================================================")
    lines.append("-- Fusion Gadgets — seed data (current schema)")
    lines.append("-- Generated from legacy seed.sql + seed-auth.sql")
    lines.append("-- Idempotent: re-running is safe (ON CONFLICT DO NOTHING).")
    lines.append("-- ============================================================")
    lines.append("BEGIN;")
    lines.append("")

    lines.append("TRUNCATE TABLE")
    lines.append("  order_events, order_items, orders,")
    lines.append("  wishlist_items, cart_items, addresses, profiles,")
    lines.append("  offer_products, offers,")
    lines.append("  product_variation_items, product_variations, product_images, products,")
    lines.append("  categories, brands")
    lines.append("  RESTART IDENTITY CASCADE;")
    lines.append("")

    # brands
    lines.append("-- brands")
    for bid, slug, name, country, blurb in brand_rows:
        blurb_escaped = blurb.replace("'", "''")
        name_escaped = name.replace("'", "''")
        country_escaped = country.replace("'", "''")
        lines.append(f"INSERT INTO brands (id,slug,name,country,blurb) VALUES ('{bid}','{slug}','{name_escaped}','{country_escaped}','{blurb_escaped}') ON CONFLICT DO NOTHING;")
    lines.append("")

    # categories
    lines.append("-- categories")
    for cid, slug, name, tagline, desc, intro, image, accent, subcats, seo_note in cat_rows:
        name_e = name.replace("'", "''")
        tagline_e = tagline.replace("'", "''")
        desc_e = desc.replace("'", "''")
        intro_e = intro.replace("'", "''") if intro else ""
        image_e = image.replace("'", "''") if image else ""
        accent_e = accent.replace("'", "''") if accent else ""
        seo_e = (seo_note or "").replace("'", "''")
        lines.append(f"INSERT INTO categories (id,slug,name,tagline,description,intro,image,accent,subcategories,seo_note) VALUES ('{cid}','{slug}','{name_e}','{tagline_e}','{desc_e}','{intro_e}','{image_e}','{accent_e}',{subcats},'{seo_e}') ON CONFLICT DO NOTHING;")
    lines.append("")

    # products
    lines.append("-- products")
    for p in product_rows:
        def q(v):
            if v is None:
                return "NULL"
            if isinstance(v, tuple) and len(v) == 2 and v[0] == "EXPRESSION":
                return v[1]
            if isinstance(v, bool):
                return "TRUE" if v else "FALSE"
            if isinstance(v, str) and v.startswith("'") and (v.endswith("::jsonb") or v.endswith("::text[]")):
                return v
            if isinstance(v, str) and v.startswith("ARRAY["):
                return v
            if isinstance(v, str) and v == "CURRENT_DATE":
                return "CURRENT_DATE"
            if isinstance(v, (int, float)):
                return str(v)
            s = str(v).replace("'", "''")
            return f"'{s}'"

        cols = ("id,sku,slug,name,subtitle,brand_id,category_id,subcategory,tagline,"
                "description,story,price,compare_at_price,currency,visual_key,accent,"
                "stock,is_active,is_preorder,"
                "highlights,includes,specs,rating,review_count,shipping,warranty,added_at")
        vals = ",".join(q(p[c]) for c in cols.split(","))
        lines.append(f"INSERT INTO products ({cols}) VALUES ({vals}) ON CONFLICT DO NOTHING;")
    lines.append("")

    # product_images
    lines.append("-- product_images")
    for img in image_rows:
        ip = "TRUE" if img["is_primary"] in (True, "true", "t") else "FALSE"
        url_e = img["url"].replace("'", "''")
        lines.append(f"INSERT INTO product_images (id,product_id,url,position,is_primary) VALUES ('{img['id']}','{img['product_id']}','{url_e}',{img['position']},{ip}) ON CONFLICT DO NOTHING;")
    lines.append("")

    # product_variations + product_variation_items (from variant data)
    lines.append("-- product_variations")
    # Group variants by parent to create one variation per group
    variation_groups = {}
    for v in variant_rows:
        parent_id = v["parent_product_id"]
        if parent_id not in variation_groups:
            variation_groups[parent_id] = []
        variation_groups[parent_id].append(v)
    
    import uuid
    for parent_id, items in variation_groups.items():
        var_id = str(uuid.uuid4())
        lines.append(f"INSERT INTO product_variations (id) VALUES ('{var_id}') ON CONFLICT DO NOTHING;")
        # Add parent as first item (position 0)
        lines.append(f"INSERT INTO product_variation_items (variation_id, product_id, option_label, position) VALUES ('{var_id}','{parent_id}','Base',0) ON CONFLICT DO NOTHING;")
        # Add child items
        for idx, item in enumerate(items):
            attrs = item["variation_attributes"]
            # Extract option label from attributes
            lines.append(f"INSERT INTO product_variation_items (variation_id, product_id, option_label, position) VALUES ('{var_id}','{item['product_id']}',{attrs},'{idx + 1}') ON CONFLICT DO NOTHING;")
    lines.append("")

    # offers
    lines.append("-- offers")
    for o in offer_rows:
        def qo(v):
            if v is None:
                return "NULL"
            if isinstance(v, tuple) and len(v) == 2 and v[0] == "EXPRESSION":
                return v[1]
            if isinstance(v, str) and v.startswith("(") and "interval" in v:
                return v  # SQL expression
            s = str(v).replace("'", "''")
            return f"'{s}'"

        cols_list = ["id", "slug", "title", "description", "badge", "terms", "status"]
        vals_list = [qo(o[c]) for c in cols_list]
        # handle optional starts_at / ends_at
        if o.get("starts_at"):
            cols_list.append("starts_at")
            vals_list.append(qo(o["starts_at"]))
        if o.get("ends_at"):
            cols_list.append("ends_at")
            vals_list.append(qo(o["ends_at"]))
        lines.append(f"INSERT INTO offers ({','.join(cols_list)}) VALUES ({','.join(vals_list)}) ON CONFLICT DO NOTHING;")
    lines.append("")

    # offer_products
    lines.append("-- offer_products")
    for op in offer_product_rows:
        oid = offer_slug_id.get(op["offer_slug"])
        if oid:
            lines.append(f"INSERT INTO offer_products (offer_id,product_id,position) SELECT '{oid}','{op['product_id']}',{op['position']} ON CONFLICT DO NOTHING;")
    lines.append("")

    # profiles
    lines.append("-- profiles")
    for p in profile_rows:
        def qp(v):
            if v is None:
                return "NULL"
            if isinstance(v, tuple) and len(v) == 2 and v[0] == "EXPRESSION":
                return v[1]
            if isinstance(v, bool):
                return "TRUE" if v else "FALSE"
            if isinstance(v, str) and v == "CURRENT_DATE":
                return "CURRENT_DATE"
            s = str(v).replace("'", "''")
            return f"'{s}'"
        pcols = ["id", "email", "full_name", "phone", "onboarding_state",
                 "pref_newsletter", "pref_product_updates", "pref_order_updates", "member_since"]
        pvals = [qp(p.get(c, "true" if c.startswith("pref_") else None)) for c in pcols]
        lines.append(f"INSERT INTO profiles ({','.join(pcols)}) VALUES ({','.join(pvals)}) ON CONFLICT DO NOTHING;")
    lines.append("")

    # addresses
    lines.append("-- addresses")
    for a in address_rows:
        def qa(v):
            if v is None:
                return "NULL"
            if isinstance(v, bool):
                return "TRUE" if v else "FALSE"
            s = str(v).replace("'", "''")
            return f"'{s}'"
        acols = ["id", "user_id", "label", "line1", "line2", "city", "state", "postcode", "country", "phone", "is_default"]
        avals = [qa(a.get(c)) for c in acols]
        lines.append(f"INSERT INTO addresses ({','.join(acols)}) VALUES ({','.join(avals)}) ON CONFLICT DO NOTHING;")
    lines.append("")

    # orders
    lines.append("-- orders")
    for oi, o in enumerate(order_rows):
        def qo2(v):
            if v is None:
                return "NULL"
            if isinstance(v, str) and ("T" in v and v.endswith("Z")):
                return f"'{v}'::timestamptz"
            s = str(v).replace("'", "''")
            return f"'{s}'"
        ocols = ["id", "order_number", "user_id", "status", "payment_method", "payment_status",
                 "currency", "subtotal", "discount_total", "shipping_total", "tax_total", "total",
                 "ship_label", "ship_line1", "ship_line2", "ship_city", "ship_state", "ship_postcode",
                 "ship_country", "ship_phone", "tracking_number", "estimated_delivery", "placed_at",
                 "idempotency_key", "idempotency_request_hash"]
        order_num = f"FG-2024-{oi+1:08d}"
        idem_key = f"seed-order-{oi+1}"
        ovals = []
        for c in ocols:
            if c == "order_number":
                ovals.append(f"'{order_num}'")
            elif c == "idempotency_key":
                ovals.append(f"'{idem_key}'")
            elif c == "idempotency_request_hash":
                ovals.append(f"'{idem_key}'")
            else:
                ovals.append(qo2(o.get(c)))
        lines.append(f"INSERT INTO orders ({','.join(ocols)}) VALUES ({','.join(ovals)}) ON CONFLICT DO NOTHING;")
    lines.append("")

    # order_items
    lines.append("-- order_items")
    for oi in order_item_rows:
        def qoi(v):
            if v is None:
                return "NULL"
            s = str(v).replace("'", "''")
            return f"'{s}'"
        oicols = ["id", "order_id", "product_id", "product_name", "product_sku",
                  "visual_key", "accent", "quantity", "unit_price", "line_discount", "line_total"]
        oivals = [qoi(oi[c]) for c in oicols]
        lines.append(f"INSERT INTO order_items ({','.join(oicols)}) VALUES ({','.join(oivals)}) ON CONFLICT DO NOTHING;")
    lines.append("")

    # order_events
    lines.append("-- order_events")
    for e in event_rows:
        lines.append(f"INSERT INTO order_events (id,order_id,event_type,metadata) VALUES ('{e['id']}','{e['order_id']}','{e['event_type']}',{e['metadata']}) ON CONFLICT DO NOTHING;")
    lines.append("")

    # product_reviews (skipped — enforce_review_eligibility requires auth.uid())
    # Reviews can only be created by logged-in users with delivered orders.

    lines.append("COMMIT;")
    lines.append("")
    lines.append("-- NOTE: to log in as test users, run seed-auth.sql separately")

    # Write output
    with open("seed_generated.sql", "w") as f:
        f.write("\n".join(lines))

    # Print summary
    print(f"Generated seed_generated.sql")
    print(f"  Brands: {len(brand_rows)}")
    print(f"  Categories: {len(cat_rows)}")
    print(f"  Products (parent): {len(by_table.get('products', []))}")
    print(f"  Products (variant children): {len(variant_rows)}")
    print(f"  Product images: {len(image_rows)}")
    print(f"  Product variants: {len(variant_rows)}")
    print(f"  Offers: {len(offer_rows)}")
    print(f"  Offer products: {len(offer_product_rows)}")
    print(f"  Profiles: {len(profile_rows)}")
    print(f"  Addresses: {len(address_rows)}")
    print(f"  Orders: {len(order_rows)}")
    print(f"  Order items: {len(order_item_rows)}")
    print(f"  Order events: {len(event_rows)}")
    print(f"  Reviews: {len(review_rows)}")
    print(f"  Skipped (not in current schema): product_badges, product_related, product_highlights table, product_specs table, product_includes table, circulation_entries, circulation_versions")

if __name__ == "__main__":
    main()
