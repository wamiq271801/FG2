# Phase 1 — Confirmed Implementation Basis

**Document type:** TASK 1.11 output — Phase 1 completion artifact  
**Date produced:** August 2026  
**Method:** Full read of all migration files (0001–0007), all Worker source files, and all frontend data modules. No code was modified.  
**Status:** CONFIRMED — no blocker prevents proceeding to Phase 2.

---

## How to Read This Document

Each section below covers one audit topic from TASK 1.1–1.10.  
For every topic the structure is:

- **Current state** — exactly what exists today, with the specific file/migration that defines it.
- **Target state** — what implementation.md requires.
- **Gap** — the concrete delta that must be closed in the relevant phase.

All gaps are summarised in the final section with their owning phase.

---

## TASK 1.1 — Products Table

### Current state

**Source:** `supabase/migrations/0001_schema.sql`, `supabase/migrations/0006_reviews.sql`

The `products` table was created with `slug text PRIMARY KEY`.  
Migration 0006 added two additional identity columns:

| Column | Type | Constraint | Notes |
|---|---|---|---|
| `slug` | text | **PRIMARY KEY** | URL/SEO identifier. Currently the relational FK used everywhere. |
| `id` | uuid | UNIQUE (index `ux_products_id`), NOT NULL, DEFAULT `gen_random_uuid()` | Added in 0006. Not yet the PK. Not yet used as FK anywhere. |
| `fgp_number` | text | UNIQUE (index `ux_products_fgp_number`), NOT NULL, DEFAULT `generate_fgp_number()` | Added in 0006. DB-generated human-readable SKU equivalent. |

Other columns present on `products`:

| Column | Type | Present? | Target requires? | Notes |
|---|---|---|---|---|
| `name` | text | ✅ | ✅ | |
| `subtitle` | text | ✅ | ✅ | |
| `brand_slug` | text FK → brands(slug) | ✅ | ✅ | Brand relationship by slug — this stays. |
| `category_slug` | text FK → categories(slug) | ✅ | ✅ | Category relationship by slug — this stays. |
| `subcategory` | text nullable | ✅ | ✅ | |
| `tagline` | text | ✅ | ✅ | |
| `description` | text | ✅ | ✅ | |
| `story` | text | ✅ | ✅ | |
| `price` | integer, CHECK price >= 0 | ✅ | ✅ | |
| `compare_at` | integer nullable | ✅ | ✅ | |
| `currency` | currency_enum | ✅ | ✅ | |
| `visual_key` | product_visual_key_enum | ✅ | ✅ | |
| `accent` | text | ✅ | ✅ | |
| `availability` | availability_enum NOT NULL DEFAULT 'in-stock' | ✅ | ❌ **REMOVE** | Contradicts stock. Must be removed and replaced by derived availability from is_active + is_preorder + stock. |
| `stock` | integer nullable, CHECK stock IS NULL OR stock >= 0 | ✅ | ✅ modified | Constraint already present but allows NULL. Target requires NOT NULL with CHECK stock >= 0. Parent products may use NULL to indicate non-sellable. This must be explicitly decided during Phase 5. |
| `rating` | numeric(2,1) | ✅ | ✅ | |
| `review_count` | integer | ✅ | ✅ | |
| `shipping` | text | ✅ | ✅ | |
| `warranty` | text | ✅ | ✅ | |
| `added_at` | date | ✅ | ✅ | |
| `is_active` | boolean NOT NULL DEFAULT true | ✅ | ✅ | |
| `is_preorder` | — | ❌ **MISSING** | ✅ | Must be added in Phase 5. |
| `highlights` | — | ❌ **MISSING** | ✅ | Must be added in Phase 3. |
| `includes` | — | ❌ **MISSING** | ✅ | Must be added in Phase 3. |
| `specs` | — | ❌ **MISSING** | ✅ | Must be added in Phase 3 as JSONB. |
| `created_at` | timestamptz | ✅ | ✅ | |
| `updated_at` | timestamptz | ✅ | ✅ | |

### Target state

Per `implementation.md`: `products.id` (UUID) is the relational identity. `products.slug` is the URL/SEO identifier only. `fgp_number` is the human-facing SKU equivalent.

In the target: `products.id` UUID is the FK that all dependent tables use. `products.slug` remains on the row but is never used as a FK.

### Gaps (owned by Phase 3 and Phase 5)

1. **`products.id` is not yet the PK** — slug is still the PK. Phase 3 must migrate all FK references to use `products.id` and then change the PK. This is the largest schema migration in the project.
2. **`products.highlights` does not exist** — Phase 3 adds this column and migrates data from `product_highlights`.
3. **`products.includes` does not exist** — Phase 3 adds this column and migrates data from `product_includes`.
4. **`products.specs` does not exist** — Phase 3 adds this column as JSONB and migrates data from `product_specs`.
5. **`products.is_preorder` does not exist** — Phase 5 adds this column.
6. **`products.availability` enum must be removed** — Phase 5 removes it after all consumers are migrated to derived availability.
7. **`products.stock` allows NULL with no NOT NULL constraint** — Phase 5 decides and enforces the NULL policy. The `CHECK stock IS NULL OR stock >= 0` partial constraint already exists; the `stock >= 0` absolute constraint (no NULL allowed for sellable products) must be enforced during Phase 5.

---

## TASK 1.2 — product_variants Table

### Current state

**Source:** `supabase/migrations/0001_schema.sql`

```
product_variants
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE
  variant_id   text NOT NULL    -- e.g. "graphite" — a text label, not a UUID
  name         text NOT NULL
  price_delta  integer DEFAULT 0
  swatch       text nullable
  in_stock     boolean NOT NULL DEFAULT true
  position     integer NOT NULL DEFAULT 0
  created_at   timestamptz
  updated_at   timestamptz
  UNIQUE(product_slug, variant_id)
```

The current model: `product_variants` is a **variant attribute table** that stores display/pricing deltas relative to a parent product. A "variant" is not its own `products` row — it is a sub-record hanging off a parent product.

Key structural facts:
- There is **no `parent_product_id`** column — the table has no concept of child products linking back to a parent product.
- There is **no `child_product_id` / second UUID** linking a variant to a separate products row.
- The `product_slug` FK points to the parent product, not a child product.
- Variant data (name, price_delta, in_stock) lives here, not in a separate `products` row.
- `in_stock` is a boolean — binary stock only. No numeric stock count per variant.
- `price_delta` is an offset from the parent price — not an independent price.

### Target state

Per `implementation.md`:

- Every variation must be a **complete `products` row** with its own independent data.
- `product_variants` becomes a relationship/grouping layer only: it connects product rows into one variation family.
- Required relationship columns: `parent_product_id` (UUID FK → products.id), `product_id` (UUID FK → products.id).
- No product data (in_stock, price_delta, name overrides) on `product_variants`.
- No runtime inheritance (`variant.field ?? parent.field` is forbidden).

### Gaps (owned by Phase 4)

1. **`product_variants` has no `parent_product_id` column** — Phase 4 must add this UUID FK.
2. **`product_variants` has no `product_id` column** (pointing to child product) — Phase 4 must add this UUID FK.
3. **`product_variants.in_stock` must be removed** — Phase 5 removes this after inventory authority moves to `products.stock`.
4. **`product_variants.price_delta` must be removed** — Phase 4 removes this after each child product stores its own independent `products.price`.
5. **`product_variants.name` must be removed** — Phase 4 removes this after each child product stores its own `products.name`.
6. **`product_variants.variant_id` (text label)** — Phase 4 determines whether to keep as a variation attribute label or remove entirely. It is not a UUID, not a FK — it serves as a display label (e.g. "graphite", "black").
7. **`product_variants.swatch` is a variation attribute** — review during Phase 4 whether it stays on the relationship row or moves to the child product.
8. **No child `products` rows exist yet** for current variants — Phase 4 must create complete `products` rows for every current variant entry and populate them with the data currently stored as delta/flag on `product_variants`.
9. **`product_slug` FK will become `parent_product_id` UUID FK** — Phase 3 (PK migration) must happen before Phase 4 can establish UUID FKs.

**Dependency note:** Phase 4 is fully dependent on Phase 3 completing the `products.id` UUID primary key migration. Phase 4 cannot add UUID FKs until Phase 3 is complete.

---

## TASK 1.3 — Metadata Tables Marked for Removal

### Current state

**Source:** `supabase/migrations/0001_schema.sql`

All five tables exist with the following structure:

#### `product_highlights`
```
id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE
body         text NOT NULL
position     integer NOT NULL DEFAULT 0
UNIQUE(product_slug, position)
```

#### `product_includes`
```
id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE
body         text NOT NULL
position     integer NOT NULL DEFAULT 0
UNIQUE(product_slug, position)
```

#### `product_specs`
```
id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE
label        text NOT NULL
value        text NOT NULL
position     integer NOT NULL DEFAULT 0
UNIQUE(product_slug, position)
```

#### `product_badges`
```
id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE
badge        text NOT NULL
position     integer NOT NULL DEFAULT 0
UNIQUE(product_slug, position)
```

#### `product_related`
```
product_slug    text NOT NULL REFERENCES products(slug) ON DELETE CASCADE
related_slug    text NOT NULL REFERENCES products(slug) ON DELETE CASCADE
position        integer NOT NULL
PRIMARY KEY (product_slug, related_slug)
CHECK (product_slug <> related_slug)
```

### Active codebase consumers confirmed

**Frontend data layer (`modules/catalog/data.ts`):**

- `DETAIL_SELECT` query string explicitly joins all five tables:
  ```
  product_badges(badge, position),
  product_variants(variant_id, name, price_delta, swatch, in_stock, position),
  product_specs(label, value, position),
  product_highlights(body, position),
  product_includes(body, position),
  product_related!product_related_product_slug_fkey(related_slug, position)
  ```
- `CARD_SELECT` query string joins `product_badges(badge, position)`.
- `mapProduct()` function reads from all five tables in the ProductRow type.
- `getFeaturedProducts()` queries `product_badges` directly by badge text ("Editor's pick") as a fallback.
- `getRelatedProducts()` reads `product.related` (sourced from `product_related`) as its primary path.

**Frontend client layer (`modules/catalog/client.ts`):**

- `SELECT` constant joins `product_badges(badge, position)`.
- `mapCard()` function reads and maps badge data.

**RLS policies (`supabase/migrations/0002_rls_policies.sql`):**

All five tables have RLS enabled and a public-read policy:
```
CREATE POLICY "product_badges_read"      ON product_badges     FOR SELECT USING (true);
CREATE POLICY "product_related_read"     ON product_related    FOR SELECT USING (true);
CREATE POLICY "product_highlights_read"  ON product_highlights FOR SELECT USING (true);
CREATE POLICY "product_includes_read"    ON product_includes   FOR SELECT USING (true);
CREATE POLICY "product_specs_read"       ON product_specs      FOR SELECT USING (true);
```

**Worker:** No Worker file references any of the five tables directly.

**Seed files:** `supabase/seed.sql` — data present (not read in this audit; will be addressed in Phase 13).

### Ordering mechanism confirmed

All five tables use a `position integer NOT NULL DEFAULT 0` column with a `UNIQUE(product_slug, position)` constraint. Migration path for Phase 3 is clear:
- highlights: `body` → ordered array in `products.highlights`
- includes: `body` → ordered array in `products.includes`
- specs: `{label, value}` → ordered array of label/value objects in `products.specs` JSONB
- badges: drop entirely, no replacement column
- related: drop entirely, no replacement table

### Gaps (owned by Phase 3 and Phase 12)

1. **`products.highlights`, `products.includes`, `products.specs` do not exist** — Phase 3 adds them and migrates data.
2. **All five tables have active frontend consumers** — Phase 12 must update `modules/catalog/data.ts` and `modules/catalog/client.ts` before tables can be dropped.
3. **`product_badges` is used as a product-selection mechanism** (`getFeaturedProducts` queries by badge text) — Phase 12 must replace this with an authoritative catalog mechanism before `product_badges` is dropped.
4. **`product_related` is the primary related-product data source** — Phase 3 must implement the algorithm-driven function, and Phase 12 must update `getRelatedProducts()` before `product_related` is dropped.
5. **RLS policies on all five tables must be dropped** along with the tables themselves in Phase 3.

---

## TASK 1.4 — Orders Table

### Current state

**Source:** `supabase/migrations/0001_schema.sql`, `supabase/migrations/0003_orders_idempotency.sql`, `supabase/migrations/0004_worker_rpc.sql`

```
orders
  id                 text PRIMARY KEY    -- "FG-YYYY-NNNN" format
  user_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT
  status             order_status_enum NOT NULL DEFAULT 'processing'
  payment_method     payment_method_enum NOT NULL DEFAULT 'cod'
  payment_status     payment_status_enum NOT NULL DEFAULT 'pending'
  currency           currency_enum NOT NULL DEFAULT 'INR'
  subtotal           integer NOT NULL CHECK (subtotal >= 0)
  discount_total     integer NOT NULL DEFAULT 0 CHECK (discount_total >= 0)
  shipping_total     integer NOT NULL DEFAULT 0 CHECK (shipping_total >= 0)
  tax_total          integer NOT NULL DEFAULT 0 CHECK (tax_total >= 0)
  total              integer NOT NULL CHECK (total >= 0)
  ship_label         text NOT NULL
  ship_line1         text NOT NULL
  ship_line2         text nullable
  ship_city          text NOT NULL
  ship_state         text NOT NULL
  ship_postcode      text NOT NULL
  ship_country       text NOT NULL
  ship_phone         text NOT NULL
  tracking_number    text nullable
  estimated_delivery date nullable
  placed_at          timestamptz NOT NULL DEFAULT now()
  created_at         timestamptz NOT NULL DEFAULT now()
  updated_at         timestamptz NOT NULL DEFAULT now()
  idempotency_key    text nullable        -- added by 0003
```

**Unique index on idempotency:**
```sql
UNIQUE INDEX idx_orders_idempotency ON orders(user_id, idempotency_key)
WHERE idempotency_key IS NOT NULL
```

**`order_status_enum` values:**
`processing`, `confirmed`, `shipped`, `out-for-delivery`, `delivered`, `cancelled`, `returned`

These exactly match the target lifecycle. No enum changes needed.

**Identity issues:**

- `orders.id` is `text PRIMARY KEY` in format `"FG-YYYY-NNNN"`.
- The `create_order` RPC generates this as: `'FG-' || EXTRACT(YEAR FROM now()) || '-' || LPAD((floor(random() * 9000) + 1000)::text, 4, '0')`.
- This gives only **9,000 possible values per year** with no retry on primary key collision.
- `orders.id` is currently used as FK in: `order_items.order_id`, `order_timeline.order_id`.
- `order_number` as a separate human-facing field does not exist — the current `id` doubles as both the relational PK and the human-facing identifier.

**Idempotency:**

- Idempotency key is user-scoped via the unique partial index. ✅
- The current RPC checks idempotency before address validation and catches `unique_violation` during INSERT. ✅
- **Gap:** The RPC does not detect when the same key is reused with materially different order data (different address, different cart state). It silently returns the existing order. Phase 7 must add detection of this case.

**Status transition enforcement:**

- No constraint, trigger, or function enforces legal status transitions.
- Any role with UPDATE access on `orders` can jump to any status.
- Currently only service_role can UPDATE (no RLS UPDATE policy for authenticated users), but no transition guard exists at the DB level.

**`order_number` as human-facing identifier:**

- Does not exist as a separate column. The `id` text field serves as the human-facing identifier.
- Phase 7 must add `orders.order_number` as a separate column, implement a production-safe generation scheme, and retain `orders.id` as UUID for internal relational identity.

### Target state

Per `implementation.md`: `orders.id` → UUID, `orders.order_number` → unique human-facing identifier, not used as FK. Legal transition enforcement at DB level. User-scoped idempotency with material-difference detection.

### Gaps (owned by Phase 7 and Phase 8)

1. **`orders.id` is text, not UUID** — Phase 7 must migrate to UUID PK. All FK references (`order_items.order_id`, `order_timeline.order_id`) must be updated.
2. **`orders.order_number` does not exist** — Phase 7 must add this column with a production-safe unique generation scheme (e.g. sequence-based).
3. **No status transition enforcement** — Phase 8 must implement a DB-level transition guard (trigger or SECURITY DEFINER function).
4. **Idempotency does not detect material differences** — Phase 7 must add this check.
5. **Estimated delivery date is hardcoded** (`now() + interval '4 days'`) in the RPC — Phase 7 must address this as part of the order transaction rewrite.

---

## TASK 1.5 — Tracking/Event Storage

### Current state

**Source:** `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls_policies.sql`, `supabase/migrations/0004_worker_rpc.sql`

The current tracking table is `order_timeline`:

```
order_timeline
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  order_id    text NOT NULL REFERENCES orders(id) ON DELETE CASCADE
  step_label  text NOT NULL
  step_date   timestamptz nullable
  step_index  integer NOT NULL CHECK (step_index >= 0)
  done        boolean NOT NULL DEFAULT false
  UNIQUE(order_id, step_index)
```

**RLS:** `order_timeline_owner_read` — SELECT only, for the order's owner via EXISTS check on `orders`.

**How it is populated:** The `create_order` RPC inserts **5 fixed steps at order creation time**, all future steps with `done = false` and `step_date = NULL`:

```sql
INSERT INTO order_timeline (...) VALUES
  (v_order_id, 'Order placed', now(), 0, true),
  (v_order_id, 'Packed', NULL, 1, false),
  (v_order_id, 'Shipped', NULL, 2, false),
  (v_order_id, 'Out for delivery', NULL, 3, false),
  (v_order_id, 'Delivered', NULL, 4, false);
```

**No code ever updates these rows** after creation. Timeline entries remain as inserted unless manually updated via service_role.

**Frontend consumer (`modules/orders/index.ts`):**

```typescript
supabase.from("order_timeline").select("*").in("order_id", orderIds)
supabase.from("order_timeline").select("*").eq("order_id", id).order("step_index")
```

The `Order` type in `types/index.ts` maps timeline to:
```typescript
timeline: { label: string; date: string; done: boolean }[]
```

### Target state

Per `implementation.md`:
- `order_timeline` must be replaced by `order_events` — an immutable, append-only event history.
- `order_events` schema: `id` (UUID PK), `order_id` (UUID FK → orders.id), `event_type` (text or enum), `created_at` (timestamptz), `metadata` (JSONB nullable).
- Do not pre-create empty future timeline rows.
- Only actual events are inserted (e.g. `order_placed` at creation, `order_confirmed` when confirmed, etc.).
- Every status transition must insert a corresponding event in the same transaction.

### Gaps (owned by Phase 8 and Phase 12)

1. **`order_events` table does not exist** — Phase 8 must create it.
2. **`order_timeline` pre-creates empty future rows** — violates the immutable event history requirement. Phase 8 must replace this with append-only event insertion.
3. **No status transition ever inserts a tracking event** — Phase 8 must implement the trigger/function that atomically updates status and inserts an event.
4. **Frontend reads `order_timeline`** — Phase 12 must update `modules/orders/index.ts` to read from `order_events`.
5. **`order_timeline` must be dropped** after frontend migration — Phase 8/12 dependency.
6. **`order_timeline.order_id` is `text` FK** — when `orders.id` becomes UUID (Phase 7), `order_timeline.order_id` must also change. Since `order_timeline` will be replaced by `order_events` in Phase 8 with a UUID FK from the start, the text FK on `order_timeline` is a transitional state. Phase 7 must coordinate the `orders.id` migration with Phase 8's `order_timeline` replacement.

---

## TASK 1.6 — cart_items Table

### Current state

**Source:** `supabase/migrations/0001_schema.sql`

```
cart_items
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  product_slug text NOT NULL REFERENCES products(slug) ON DELETE CASCADE
  variant_id   text NOT NULL DEFAULT ''
  quantity     integer NOT NULL CHECK (quantity BETWEEN 1 AND 99)
  created_at   timestamptz NOT NULL DEFAULT now()
  updated_at   timestamptz NOT NULL DEFAULT now()
  UNIQUE(user_id, product_slug, variant_id)
```

**Quantity constraint:** `CHECK (quantity BETWEEN 1 AND 99)` — this already satisfies:
- `quantity >= 1` ✅
- A practical maximum of 99 ✅

This constraint is defined at the database level. It is the same constraint both layers must validate.

**Product reference:** `product_slug text NOT NULL REFERENCES products(slug)` — slug-based FK, not UUID.

**Variant reference:** `variant_id text NOT NULL DEFAULT ''` — stores the `variant_id` text label from `product_variants`, not a UUID product reference. The empty string `''` denotes "no variant selected".

**RLS:** `cart_items_owner_all` — ALL operations where `auth.uid() = user_id`. ✅

**Worker validation (`worker/src/lib/validation.ts`):**

`validateOrderRequest` validates `addressId` and `idempotencyKey` only. It does not validate cart item quantities — these are trusted from the cart as written.

The cart items are written directly by the frontend via Supabase client (RLS-constrained, no Worker involvement for cart mutations). The DB constraint enforces `BETWEEN 1 AND 99`.

### Target state

Per `implementation.md`:
- `quantity >= 1` DB constraint ✅ (already exists)
- Practical maximum constraint ✅ (99 already exists — must be explicitly confirmed as the business maximum)
- `product_id` UUID FK replacing `product_slug` text FK
- Variant selection stores the actual child product UUID (not a variant_id text label)

### Gaps (owned by Phase 6 and Phase 4)

1. **`cart_items.product_slug` is a text slug FK, not a UUID `product_id`** — Phase 6 (after Phase 3 completes the PK migration) must rename this to `product_id` and make it a UUID FK → `products.id`.
2. **`cart_items.variant_id` text label must be removed** — Phase 4/6 must replace the variant_id mechanism. In the target, a variant selection simply sets `product_id` to the actual child product's UUID. No separate `variant_id` text column is needed.
3. **The maximum quantity of 99 must be explicitly confirmed** as the business maximum during Phase 6 and documented. It already exists in the DB constraint — if 99 is the confirmed maximum, TASK 6.2 is essentially a verification task rather than a schema change.
4. **Worker `validateOrderRequest` does not validate quantity from the cart** — in the target, the Worker validates request body inputs, and the DB constraint enforces cart integrity. This relationship is correct per implementation.md (both layers protect different boundaries). Phase 6 must verify the Worker-side application validation mirrors the DB constraint.
5. **`UNIQUE(user_id, product_slug, variant_id)` must become `UNIQUE(user_id, product_id)`** — Phase 6 must update this constraint after the FK migration.

---

## TASK 1.7 — product_reviews Table

### Current state

**Source:** `supabase/migrations/0006_reviews.sql`

The original `product_reviews` table (created in 0001 with a `product_slug` FK and editorial/free-text author) was **completely dropped and rebuilt** in migration 0006:

```
product_reviews
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5)
  title       text NOT NULL DEFAULT ''
  body        text NOT NULL CHECK (length(body) > 0)
  created_at  timestamptz NOT NULL DEFAULT now()
  updated_at  timestamptz NOT NULL DEFAULT now()
  UNIQUE(user_id, product_id)
```

**Identity:** `product_reviews.product_id` is a UUID FK → `products(id)`. ✅  
**User identity:** `product_reviews.user_id` is a UUID FK → `auth.users(id)`. ✅  
**No slug, SKU, or email used as relational identity.** ✅

**RLS policies (0006):**
- `product_reviews_public_read` — SELECT for all (anon + authenticated). ✅
- `product_reviews_owner_insert` — INSERT for authenticated only, `user_id = auth.uid()` AND `can_review_product(product_id)`. ✅
- `product_reviews_owner_update` — UPDATE for owner only. ✅
- No DELETE policy — customer delete is denied. ✅

**Review eligibility function (`can_review_product`):**

```sql
CREATE OR REPLACE FUNCTION can_review_product(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = auth.uid()
      AND o.status = 'delivered'
      AND oi.product_slug = (SELECT slug FROM products WHERE id = p_product_id)
  );
$$;
```

**Gap in `can_review_product`:** This function looks up the product's `slug` from its `id`, then checks `order_items.product_slug`. This is because `order_items.product_slug` is still a text slug reference (not a UUID). Once Phase 7 migrates `order_items.product_id` to UUID, this function must be updated to use `oi.product_id = p_product_id` directly.

### Target state

Per `implementation.md`: `product_reviews.product_id` UUID FK ✅, `product_reviews.user_id` UUID FK ✅, eligibility enforced by delivered purchase check ✅.

The review table itself is already at the target state. The only dependency is on Phase 7's `order_items` UUID migration for `can_review_product` to be updated.

### Gaps (owned by Phase 7 and Phase 12)

1. **`can_review_product` joins via slug** (`oi.product_slug`) — Phase 7 must update this function to join via `order_items.product_id` UUID after the order items FK migration.
2. **No frontend review write/read implementation was audited in detail** — Phase 12 must confirm the review form and display pass the correct `product_id` UUID.
3. **Review count on `products` (`review_count`) is a manually maintained counter** — no trigger auto-increments it on review insert. Phase 12 or Phase 13 should verify this is kept consistent (either via trigger or RPC).

---

## TASK 1.8 — Rate-Limit Table

### Current state

**Source:** `supabase/migrations/0004_worker_rpc.sql`

```
worker_rate_limits
  key        text NOT NULL
  created_at timestamptz NOT NULL DEFAULT now()
```

**Index:** `idx_rate_limits_key_time ON worker_rate_limits(key, created_at)`

No PK. No NOT NULL constraint on `key` beyond implicit NOT NULL.

**Key format in current usage (from Worker source files):**

| Endpoint | Key format |
|---|---|
| Register (IP) | `register:<ip>` |
| Register (email) | `register:<normalized_email>` |
| OTP resend (email) | `resend:<normalized_email>` |
| Password reset (combined) | `reset:<normalized_email>:<ip>` |
| Order creation (user) | `orders:<user.id>` |

These are arbitrary concatenated strings. The email addresses are stored in plaintext (not hashed) in the rate_limit key column.

**`check_rate_limit` function:**
```sql
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
```

**RLS:** `worker_rate_limits` has RLS enabled but no policies for anon/authenticated (they are denied by default). Service_role bypasses RLS.

### Target state

Per `implementation.md`: Structured table with `action`, `dimension`, `subject_hash`, `created_at`. Use HMAC/hashes rather than raw email/IP. No concatenated string keys.

### Gaps (owned by Phase 10)

1. **Table structure is unstructured** — single `key` text column. Phase 10 must replace with `action`, `dimension`, `subject_hash`, `created_at`.
2. **Raw normalized emails stored in the key column** — `register:<email>` and `resend:<email>` store plaintext email in the rate limit store. Phase 10 must use HMAC/hash of the subject.
3. **`check_rate_limit` EXECUTE granted to `anon` and `authenticated`** — a browser user can call this RPC directly to pollute the store. Phase 2 must fix this grant. Phase 10 will rebuild the function to match the structured schema.
4. **No IP limit on OTP resend** — only email-based. `handleResendSignup` does not call `checkRateLimit` with an IP dimension. Phase 10 must add IP protection.
5. **Password reset rate limit uses a combined email+IP key** (`reset:<email>:<ip>`) — this is a single combined check (5/900s) rather than the target model's separate email (1/24h) and IP (3/24h) limits. Phase 10 must split this into two separate checks.
6. **No successful reset cooldown** — no 24-hour post-reset cooldown is implemented. Phase 10 must add this.
7. **No IP rate limit on order creation** — only user-scoped (`orders:<user.id>`). Phase 10 must add IP protection.
8. **`worker_rate_limits` table name** — Phase 10 may rename to `rate_limits` or keep the name; must be consistent throughout.

---

## TASK 1.9 — RPC Execution Permissions

### Current state

**Source:** `supabase/migrations/0004_worker_rpc.sql`

```sql
GRANT EXECUTE ON FUNCTION check_rate_limit(text, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_order(uuid, uuid, text) TO authenticated;
```

**`check_rate_limit`:** Callable by `anon`, `authenticated`, `service_role`.  
**`create_order`:** Callable by `authenticated`, `service_role`.

Both functions are `SECURITY DEFINER`.

**Security consequence of current grants:**

- An authenticated browser user can POST to `/rest/v1/rpc/check_rate_limit` with any `p_key`, `p_max`, `p_window_seconds` values, bypassing the Worker entirely. This can pollute the rate-limit store or consume entries for legitimate keys.
- An authenticated browser user can POST to `/rest/v1/rpc/create_order` with any `p_user_id`, `p_address_id`, `p_idempotency_key` values, bypassing the Worker's rate limiting, JWT verification flow, and all Worker-level security controls. The RPC validates address ownership and reads the authenticated user's cart, but the Worker's rate limit (5/900s) is completely bypassed.

### Target state

Per `implementation.md`: Both `check_rate_limit` and `create_order` must not be callable from browser roles. Only the trusted Worker/service_role boundary may call them.

### Gaps (owned by Phase 2 — highest priority)

1. **`EXECUTE` on `check_rate_limit` must be REVOKED from `anon` and `authenticated`** — Phase 2 TASK 2.2. This is a security fix that must happen before any other phase begins.
2. **`EXECUTE` on `create_order` must be REVOKED from `authenticated`** — Phase 2 TASK 2.1. This is a security fix that must happen before any other phase begins.
3. **After revocation, the Worker's call path via `supabaseRestFetch` with service_role key must continue to work** — service_role is not affected by REVOKE targeting `anon`/`authenticated`. Worker continues to work as-is after the fix.

---

## TASK 1.10 — RLS Policies

### Current state

**Source:** `supabase/migrations/0002_rls_policies.sql`

Full RLS policy inventory for all in-scope tables:

| Table | RLS Enabled | Policies | Classification |
|---|---|---|---|
| `categories` | ✅ | SELECT = true (public read) | Catalog — public read, no user write |
| `brands` | ✅ | SELECT = true (public read) | Catalog — public read, no user write |
| `products` | ✅ | SELECT = true (public read) | Catalog — public read, no user write |
| `product_images` | ✅ | SELECT = true (public read) | Catalog — public read, no user write |
| `product_variants` | ✅ | SELECT = true (public read) | Catalog — public read, no user write |
| `product_specs` | ✅ | SELECT = true (public read) | Catalog — public read, no user write |
| `product_highlights` | ✅ | SELECT = true (public read) | Catalog — public read (drops with table in Phase 3) |
| `product_includes` | ✅ | SELECT = true (public read) | Catalog — public read (drops with table in Phase 3) |
| `product_badges` | ✅ | SELECT = true (public read) | Catalog — public read (drops with table in Phase 3) |
| `product_related` | ✅ | SELECT = true (public read) | Catalog — public read (drops with table in Phase 3) |
| `product_reviews` | ✅ | Public read, authenticated insert (eligibility-gated), owner update, no delete | User-owned content — correct ✅ |
| `offers` | ✅ | SELECT = true (public read) | Public read, no user write |
| `offer_products` | ✅ | SELECT = true (public read) | Public read, no user write |
| `profiles` | ✅ | Owner SELECT, owner UPDATE | User-owned — correct ✅ |
| `addresses` | ✅ | Owner ALL (SELECT/INSERT/UPDATE/DELETE) | User-owned — correct ✅ |
| `cart_items` | ✅ | Owner ALL | User-owned — correct ✅ |
| `wishlist_items` | ✅ | Owner ALL | User-owned — correct ✅ |
| `orders` | ✅ | Owner SELECT only, no user INSERT/UPDATE/DELETE | Service-role creates, user reads own — correct ✅ |
| `order_items` | ✅ | Owner SELECT (via orders EXISTS check) | Service-role creates, user reads own — correct ✅ |
| `order_timeline` | ✅ | Owner SELECT (via orders EXISTS check) | Will be replaced by order_events in Phase 8 |
| `signup_authorizations` | ✅ | **No policies** (anon/authenticated denied by default) | Internal security — correct ✅ |
| `worker_rate_limits` | ✅ | **No policies** (anon/authenticated denied by default) | Internal security — RLS correct, but RPC grants are wrong (Phase 2) |
| `circulation_versions` | ✅ | SELECT where status = 'published' | Ranking system — do not touch ✅ |
| `circulation_entries` | ✅ | SELECT where version is published | Ranking system — do not touch ✅ |

**Key RLS findings:**

1. **`order_events` does not exist** — no RLS to audit yet. Phase 8 creates it with correct policies.
2. **`products.stock` is not directly writable by browser roles** — `products_public_read` only grants SELECT. No INSERT/UPDATE/DELETE policy for authenticated users exists on `products`. Service_role bypasses. ✅
3. **`orders.status` is not directly writable by browser roles** — `orders_owner_read` is SELECT only. ✅
4. **No RLS gap on user-owned tables** — all user-owned tables (profiles, addresses, cart_items, wishlist_items) correctly enforce `auth.uid() = user_id`.
5. **`signup_authorizations` RLS is correct** — no policies means anon/authenticated are denied. The RPC grants from Phase 2 audit are the actual gap, not RLS.

### Gaps (owned by Phase 2 and Phase 8)

1. **`check_rate_limit` and `create_order` RPC grants** — these are GRANT issues, not RLS issues. Addressed in Phase 2.
2. **`order_events` RLS** — does not exist yet. Phase 8 creates it with append-only semantics (no browser UPDATE/DELETE/INSERT).
3. **`order_timeline` RLS** — the existing `order_timeline_owner_read` policy will be dropped when `order_timeline` is dropped in Phase 8.
4. **No change needed to any existing RLS policy** for Phase 2 — the current policies are correctly scoped.

---

## Gap Summary Table

This table collects every gap found across TASK 1.1–1.10 and maps each gap to its owning phase from `task.md`.

| # | Gap | Severity | Owning Phase | Blocking? |
|---|---|---|---|---|
| G-01 | `create_order` EXECUTE granted to `authenticated` — browser bypass of Worker security | **CRITICAL** | Phase 2 / TASK 2.1 | Yes — must be fixed before any other schema work |
| G-02 | `check_rate_limit` EXECUTE granted to `anon`, `authenticated` — rate-limit store can be polluted | **CRITICAL** | Phase 2 / TASK 2.2 | Yes — must be fixed before any other schema work |
| G-03 | Hardcoded service-role key and Turnstile secret in `env.ts` | **HIGH** | Phase 2 / TASK 2.3 | Yes — security risk in any deployment |
| G-04 | `supabaseRestFetch` has no timeout — Worker can hang indefinitely | **HIGH** | Phase 2 / TASK 2.4 | No |
| G-05 | `products.id` is not the PK — slug is still the PK | **HIGH** | Phase 3 | Blocks Phase 4, 5, 6, 7 |
| G-06 | `products.highlights` column missing | Medium | Phase 3 / TASK 3.1 | Blocks data migration |
| G-07 | `products.includes` column missing | Medium | Phase 3 / TASK 3.1 | Blocks data migration |
| G-08 | `products.specs` JSONB column missing | Medium | Phase 3 / TASK 3.1 | Blocks data migration |
| G-09 | `product_highlights` table has active frontend consumer | Medium | Phase 12 / TASK 12.1 | Blocks table drop |
| G-10 | `product_includes` table has active frontend consumer | Medium | Phase 12 / TASK 12.1 | Blocks table drop |
| G-11 | `product_specs` table has active frontend consumer | Medium | Phase 12 / TASK 12.1 | Blocks table drop |
| G-12 | `product_badges` table has active frontend consumer (card queries + getFeaturedProducts) | Medium | Phase 12 / TASK 12.1 | Blocks table drop |
| G-13 | `product_related` table is primary related-product data source | Medium | Phase 12 / TASK 12.9 | Blocks table drop |
| G-14 | `product_variants` has no `parent_product_id` or `product_id` UUID columns | **HIGH** | Phase 4 / TASK 4.1-4.3 | Blocks variation model migration |
| G-15 | `product_variants.in_stock` boolean (competing inventory authority) | Medium | Phase 5 / TASK 5.2 | |
| G-16 | `product_variants.price_delta`, `name`, `variant_id` — data belongs on child products | Medium | Phase 4 | |
| G-17 | `products.availability` enum (competing availability authority) | Medium | Phase 5 / TASK 5.3 | |
| G-18 | `products.is_preorder` column missing | Medium | Phase 5 / TASK 5.1 | |
| G-19 | `products.stock` allows NULL with partial constraint only | Medium | Phase 5 / TASK 5.1 | |
| G-20 | No stock decrement in `create_order` RPC | **CRITICAL** | Phase 7 | |
| G-21 | `cart_items.product_slug` is text slug FK, not UUID `product_id` | **HIGH** | Phase 6 / TASK 6.4 | |
| G-22 | `cart_items.variant_id` text label — must be replaced by actual child product UUID selection | Medium | Phase 4/6 | |
| G-23 | Quantity maximum of 99 must be explicitly confirmed as the business maximum | Low | Phase 6 / TASK 6.2 | |
| G-24 | `orders.id` is text PK ("FG-YYYY-NNNN"), not UUID | **HIGH** | Phase 7 | Blocks all FK migrations |
| G-25 | `orders.order_number` does not exist as separate column | Medium | Phase 7 / TASK 7.8 | |
| G-26 | Order ID generation scheme has collision risk (9000 values/year) | Medium | Phase 7 / TASK 7.8 | |
| G-27 | No status transition enforcement at DB level | **HIGH** | Phase 8 / TASK 8.2 | |
| G-28 | `order_events` table does not exist | **HIGH** | Phase 8 / TASK 8.1 | |
| G-29 | `order_timeline` pre-creates future rows (violates immutable event model) | **HIGH** | Phase 8 | |
| G-30 | Frontend reads `order_timeline` | Medium | Phase 12 / TASK 12.7 | Blocks table drop |
| G-31 | Idempotency does not detect material-difference key reuse | Medium | Phase 7 / TASK 7.3 | |
| G-32 | `can_review_product` joins via `order_items.product_slug` (slug, not UUID) | Medium | Phase 7 | |
| G-33 | `worker_rate_limits` uses unstructured concatenated text keys | Medium | Phase 10 / TASK 10.1 | |
| G-34 | Raw email stored in plaintext in rate-limit keys | Medium | Phase 10 / TASK 10.1 | |
| G-35 | No IP rate limit on OTP resend | Medium | Phase 10 / TASK 10.4 | |
| G-36 | Password reset rate limit is one combined check, not separate email + IP + cooldown limits | Medium | Phase 10 / TASK 10.5 | |
| G-37 | No IP rate limit on order creation | Medium | Phase 10 / TASK 10.6 | |
| G-38 | `auth.service.ts` mixes registration, OTP support, password recovery in one file | Low | Phase 9 / TASK 9.2 | |
| G-39 | `normalizeEmail` duplicated in `validation.ts` and `signup-auth.ts` | Low | Phase 9 / TASK 9.5 | |
| G-40 | `middleware/auth.ts` is a one-line pass-through with no added value | Low | Phase 9 / TASK 9.4 | |
| G-41 | `dev.ts` is not referenced in any script or import | Low | Phase 9 / TASK 9.1 | |
| G-42 | Order error codes are in an inline map in `orders.service.ts`, not in the global error contract | Low | Phase 11 / TASK 11.2 | |
| G-43 | Global error contract uses `{ code, title }` — target uses `{ code, message, status }` | Medium | Phase 11 / TASK 11.1 | |
| G-44 | `offer_products` references products by slug — must be by UUID after Phase 3 | Medium | Phase 3 | |

---

## Phase Ordering Validation

Based on the gap analysis, the required phase ordering is:

```
Phase 2  — Security hardening (G-01, G-02, G-03, G-04)
             ↓ must happen first — closes browser bypass gaps before any schema work
Phase 3  — Product schema migration (G-05 is the anchor, enables G-06–G-13)
             ↓ must happen before Phase 4 (requires products.id as UUID PK)
Phase 4  — Variation model migration (G-14–G-16)
             ↓ must happen before Phase 5 (variant stock removal)
Phase 5  — Inventory rewrite (G-17–G-20)
             ↓ must happen before Phase 6 (availability model is correct before cart validation)
Phase 6  — Cart integrity (G-21–G-23)
             ↓ must happen before Phase 7 (cart FK is correct UUID before order reads cart)
Phase 7  — Checkout and order rewrite (G-24–G-26, G-31–G-32)
             ↓ must happen before Phase 8 (orders.id UUID is required for order_events FK)
Phase 8  — Order lifecycle and tracking (G-27–G-30)
Phase 9  — Worker structure (G-38–G-41) — can proceed in parallel with Phase 8
Phase 10 — Rate limiting (G-33–G-37) — depends on Phase 9 structure being stable
Phase 11 — Global error contract (G-42–G-43) — depends on Phase 9 structure being stable
Phase 12 — Frontend migration (G-09–G-13, G-30)
Phase 13 — Seed and verification
```

This ordering matches the phase sequence in `task.md` exactly. No reordering is required.

---

## Confirmed Implementation Basis

All required information is now established. The implementation can proceed starting with Phase 2.

**Confirmed facts:**

1. `products.id` UUID exists (added in 0006) but is not yet the PK — slug is still PK. This is the foundational migration for the entire refactor.

2. `product_variants` is a flat attribute table with no parent/child UUID relationships. Phase 4 is a substantial migration requiring new products rows for every current variant.

3. All five metadata tables (`product_highlights`, `product_includes`, `product_specs`, `product_badges`, `product_related`) exist and are actively consumed by the frontend. They cannot be dropped until Phase 12 migration is complete.

4. `orders.id` is `text` (not UUID). `order_number` does not exist as a separate column. The FK chain (`order_items.order_id`, `order_timeline.order_id`) all use text. Phase 7 is the foundational migration for the order model.

5. `order_timeline` exists with pre-created empty rows. `order_events` does not exist. This is a replace-not-alter migration in Phase 8.

6. `cart_items.quantity CHECK (quantity BETWEEN 1 AND 99)` already exists. The DB constraint is present. Phase 6 must explicitly confirm 99 as the business maximum and ensure application-layer validation mirrors it.

7. `product_reviews` is already at the target UUID model (`product_id` UUID FK, `user_id` UUID FK). It only needs `can_review_product` updated in Phase 7 to use UUID joins.

8. `worker_rate_limits` uses unstructured concatenated text keys with raw emails. The `check_rate_limit` RPC grants are the most immediately dangerous issue — they are the first task of Phase 2.

9. `create_order` and `check_rate_limit` are both callable by browser roles right now. This must be fixed in Phase 2 before any other implementation work begins.

10. `dev.ts` is confirmed unused in any npm script or import. It is safe to remove in Phase 9.

11. The authentication architecture (`signup_authorizations`, `hook_validate_signup_authorization`, `consume_signup_authorization`, Before User Created Hook, `on_auth_user_created` trigger) is fully intact and must not be modified.

12. `circulation_versions` and `circulation_entries` are present and untouched. Their RLS policies are correct. No Phase 1–13 task touches them.

**No blocker prevents proceeding to Phase 2.**
