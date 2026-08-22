# FUSION GADGETS — IMPLEMENTATION TASK SEQUENCE

This document is the authoritative, ordered task list derived from `implementation.md`.

Every task is actionable and bounded. Tasks are executed one at a time, in the order listed.
Do not reorder phases. Do not combine tasks across phases. Do not execute any task until
explicitly instructed to begin.

No Admin tasks are included. No ranking/circulation tasks are included.

---

## PHASE 1 — FREEZE AND VERIFY TARGET SCHEMA

---

### TASK 1.1

**Phase:** 1  
**Objective:** Audit current `products` table schema against the target identity model.  
**Exact Change:** Read and document the current `products` table columns. Confirm that `id` is UUID, `sku` is present and DB-generated, `slug` is present. Identify any missing columns (`highlights`, `includes`, `specs` JSONB, `is_active`, `is_preorder`, `stock`). Produce a written gap list.  
**Affected Area:** Database schema — `products` table.  
**Validation Required:** Gap list is complete and matches the target model in `implementation.md`.  
**Dependencies:** None.

---

### TASK 1.2

**Phase:** 1  
**Objective:** Audit `product_variants` table schema against the target variation relationship model.  
**Exact Change:** Read and document the current `product_variants` table columns. Confirm `parent_product_id` and `product_id` are UUID foreign keys to `products`. Identify columns that store variant product data that must not live here (e.g. `in_stock`, price duplicates).  
**Affected Area:** Database schema — `product_variants` table.  
**Validation Required:** Gap list identifies all columns to be removed and confirms the relationship-only purpose of the table.  
**Dependencies:** TASK 1.1.

---

### TASK 1.3

**Phase:** 1  
**Objective:** Audit metadata tables marked for removal.  
**Exact Change:** Read and document current schema and row counts for `product_highlights`, `product_includes`, `product_specs`, `product_badges`, and `product_related`. Confirm data can be migrated into the target embedded columns on `products`.  
**Affected Area:** Database schema — metadata tables.  
**Validation Required:** Confirmed row counts, ordering columns, and migration path for each table.  
**Dependencies:** TASK 1.1.

---

### TASK 1.4

**Phase:** 1  
**Objective:** Audit `orders` table against the target order identity and lifecycle model.  
**Exact Change:** Read and document current `orders` columns. Confirm `id` is UUID. Confirm `order_number` scheme. Identify whether `order_number` is used as a foreign key anywhere. Identify current status enum values. Identify whether `idempotency_key` exists and is user-scoped. Identify any missing columns.  
**Affected Area:** Database schema — `orders` table.  
**Validation Required:** Written gap list including status enum values, order_number scheme, idempotency implementation, and any columns to add or remove.  
**Dependencies:** None.

---

### TASK 1.5

**Phase:** 1  
**Objective:** Audit tracking/event storage against the target `order_events` model.  
**Exact Change:** Read and document any existing tracking or event tables. Determine whether `order_events` already exists or must be created. Identify current event/status recording approach. Confirm whether status transitions are currently enforced at the database layer.  
**Affected Area:** Database schema — tracking/event tables.  
**Validation Required:** Written confirmation of what exists, what is missing, and what must be replaced.  
**Dependencies:** TASK 1.4.

---

### TASK 1.6

**Phase:** 1  
**Objective:** Audit `cart_items` table against the target cart integrity model.  
**Exact Change:** Read and document `cart_items` columns. Confirm `product_id` is a UUID foreign key. Confirm `user_id` is a UUID foreign key. Check whether a `quantity >= 1` DB constraint exists. Check whether a maximum quantity constraint exists. Identify missing constraints.  
**Affected Area:** Database schema — `cart_items` table.  
**Validation Required:** Written gap list of missing constraints and any non-UUID relational references.  
**Dependencies:** None.

---

### TASK 1.7

**Phase:** 1  
**Objective:** Audit `product_reviews` table against the target review relationship model.  
**Exact Change:** Read and document `product_reviews` columns. Confirm `user_id` and `product_id` are UUID foreign keys. Confirm no slug or SKU is used as a relational key. Identify any review eligibility enforcement currently in place.  
**Affected Area:** Database schema — `product_reviews` table.  
**Validation Required:** Written confirmation that the table uses UUID identity correctly, and a note on any missing eligibility enforcement.  
**Dependencies:** None.

---

### TASK 1.8

**Phase:** 1  
**Objective:** Audit rate-limit table against the target structured rate-limit model.  
**Exact Change:** Read and document the current rate-limit table schema. Identify whether it uses the old concatenated-key approach or the target structured approach (`action`, `dimension`, `subject_hash`, `created_at`). Identify any raw email or IP stored as plaintext.  
**Affected Area:** Database schema — rate-limit table.  
**Validation Required:** Written gap list and confirmation of what must change.  
**Dependencies:** None.

---

### TASK 1.9

**Phase:** 1  
**Objective:** Audit `check_rate_limit` RPC and `create_order` RPC for current execution permission grants.  
**Exact Change:** Locate the current definitions of `check_rate_limit` and `create_order` database functions/RPCs. Confirm which roles can execute them. Document any current SECURITY DEFINER / SECURITY INVOKER settings.  
**Affected Area:** Database — RPC definitions and grants.  
**Validation Required:** Written record of current grants and a clear statement of what changes are required in Phase 2.  
**Dependencies:** None.

---

### TASK 1.10

**Phase:** 1  
**Objective:** Audit all RLS policies on tables affected by this refactor.  
**Exact Change:** For every table in scope (`products`, `product_variants`, `cart_items`, `orders`, `order_items`, `product_reviews`, `addresses`, `rate_limit`, `signup_authorizations`, `order_events` if it exists), document the current RLS policies and the intended classification (user-owned, internal/no-browser, privileged-mutation-only).  
**Affected Area:** Database — RLS policies.  
**Validation Required:** Written classification table confirming which policies need changes.  
**Dependencies:** None.

---

### TASK 1.11

**Phase:** 1  
**Objective:** Produce the confirmed implementation basis document.  
**Exact Change:** Consolidate the outputs of TASK 1.1 through TASK 1.10 into a single written summary that confirms the implementation basis is understood, gaps are identified, and no blocker prevents proceeding to Phase 2.  
**Affected Area:** Documentation only.  
**Validation Required:** All gaps from previous tasks are listed. Confirmed that no fundamental blocker requires a plan change.  
**Dependencies:** TASK 1.1 through TASK 1.10.

---

## PHASE 2 — DATABASE SECURITY HARDENING

---

### TASK 2.1

**Phase:** 2  
**Objective:** Restrict `create_order` RPC to the trusted Worker/service-role boundary only.  
**Exact Change:** Revoke execution of `create_order` from `anon` and `authenticated` roles. Grant execution only to the `service_role` or equivalent trusted Worker boundary. Update the function's SECURITY context as required.  
**Affected Area:** Database — `create_order` RPC grants.  
**Validation Required:** Attempting to call `create_order` from an `anon` or `authenticated` role must fail with a permission error. Service-role call must succeed.  
**Dependencies:** TASK 1.9.

---

### TASK 2.2

**Phase:** 2  
**Objective:** Restrict `check_rate_limit` RPC to the trusted Worker/service-role boundary only.  
**Exact Change:** Revoke execution of `check_rate_limit` from `anon` and `authenticated` roles. Grant execution only to the `service_role` or equivalent trusted Worker boundary.  
**Affected Area:** Database — `check_rate_limit` RPC grants.  
**Validation Required:** Attempting to call `check_rate_limit` from an `anon` or `authenticated` role must fail. Service-role call must succeed.  
**Dependencies:** TASK 1.9.

---

### TASK 2.3

**Phase:** 2  
**Objective:** Remove hardcoded production/test service credentials from Worker `env.ts`.  
**Exact Change:** Locate all hardcoded service-role keys, Turnstile secrets, or other credential fallback values in `env.ts`. Replace them with required runtime environment variable reads. Throw a startup error if required secrets are missing at runtime. Do not leave any credential as a source-code fallback value.  
**Affected Area:** Worker — `src/config/env.ts`.  
**Validation Required:** Worker refuses to start if required environment variables are absent. No credential value is present in source code.  
**Dependencies:** TASK 1.9.

---

### TASK 2.4

**Phase:** 2  
**Objective:** Add a bounded timeout to shared Supabase REST calls in the Worker.  
**Exact Change:** Locate the shared Supabase client initialization in the Worker. Add a request timeout so that Worker requests do not hang indefinitely on upstream Supabase operations. Do not add arbitrary retry loops.  
**Affected Area:** Worker — Supabase infrastructure client.  
**Validation Required:** A simulated slow/unresponsive Supabase call times out within the defined bound rather than hanging.  
**Dependencies:** TASK 2.3.

---

### TASK 2.5

**Phase:** 2  
**Objective:** Verify and correct RLS policies on internal security tables.  
**Exact Change:** Using the classification output from TASK 1.10, review RLS policies on `rate_limit` and `signup_authorizations`. Confirm that no browser-role (`anon`, `authenticated`) can SELECT, INSERT, UPDATE, or DELETE from these tables directly. Fix any policy that allows direct browser access.  
**Affected Area:** Database — RLS policies on `rate_limit` and `signup_authorizations`.  
**Validation Required:** Direct browser-role queries against these tables must be denied by RLS.  
**Dependencies:** TASK 1.10, TASK 2.1, TASK 2.2.

---

### TASK 2.6

**Phase:** 2  
**Objective:** Verify service-role boundaries for privileged order/inventory mutation.  
**Exact Change:** Confirm that `orders`, `order_items`, and stock mutation operations are not directly writable by `anon` or `authenticated` roles via RLS or direct table grants. Document any policy that must change. Apply corrections.  
**Affected Area:** Database — RLS policies on `orders`, `order_items`, `products` (stock column).  
**Validation Required:** Direct browser-role INSERT/UPDATE against `orders`, `order_items`, and `products.stock` must be denied by RLS/grants.  
**Dependencies:** TASK 1.10.

---

## PHASE 3 — PRODUCT SCHEMA MIGRATION

---

### TASK 3.1

**Phase:** 3  
**Objective:** Add missing columns to `products` for embedded metadata.  
**Exact Change:** Add `highlights` (ordered array, e.g. `text[]` or `jsonb`), `includes` (ordered array), `specs` (JSONB, ordered array of label/value objects) to the `products` table if they do not exist. Do not remove any existing column yet.  
**Affected Area:** Database schema — `products` table.  
**Validation Required:** New columns exist on `products` with the correct types. Existing data is unaffected.  
**Dependencies:** TASK 1.1, TASK 1.3.

---

### TASK 3.2

**Phase:** 3  
**Objective:** Migrate `product_highlights` data into `products.highlights`.  
**Exact Change:** For each product, read ordered rows from `product_highlights` and write the ordered highlight values into `products.highlights`. Preserve sort order. Verify row counts match before and after migration.  
**Affected Area:** Database data — `products.highlights`, `product_highlights`.  
**Validation Required:** Every product that had highlight rows now has them in `products.highlights` in the correct order. No highlight data is lost.  
**Dependencies:** TASK 3.1.

---

### TASK 3.3

**Phase:** 3  
**Objective:** Migrate `product_includes` data into `products.includes`.  
**Exact Change:** For each product, read ordered rows from `product_includes` and write the ordered include values into `products.includes`. Preserve sort order. Verify row counts match.  
**Affected Area:** Database data — `products.includes`, `product_includes`.  
**Validation Required:** Every product that had include rows now has them in `products.includes` in the correct order. No data is lost.  
**Dependencies:** TASK 3.1.

---

### TASK 3.4

**Phase:** 3  
**Objective:** Migrate `product_specs` data into `products.specs`.  
**Exact Change:** For each product, read ordered rows from `product_specs` and write them as an ordered array of `{label, value}` objects into `products.specs` JSONB. Preserve current display order. Verify row counts match.  
**Affected Area:** Database data — `products.specs`, `product_specs`.  
**Validation Required:** Every product that had spec rows now has them in `products.specs` as a correctly ordered array. No data is lost.  
**Dependencies:** TASK 3.1.

---

### TASK 3.5

**Phase:** 3  
**Objective:** Audit all application and RPC references to `product_highlights`, `product_includes`, `product_specs`, `product_badges`, and `product_related` before removal.  
**Exact Change:** Search the entire codebase (frontend, Worker, database functions, triggers, RLS policies, seed files) for any reference to these five tables. Document every reference location.  
**Affected Area:** Codebase-wide audit.  
**Validation Required:** Written list of every reference that must be updated before the tables can be dropped.  
**Dependencies:** TASK 3.2, TASK 3.3, TASK 3.4.

---

### TASK 3.6

**Phase:** 3  
**Objective:** Verify that all consumer references to the five metadata tables have been updated to the new embedded columns.  
**Exact Change:** For each reference found in TASK 3.5, confirm it has been updated to read from the embedded columns or is scheduled for removal in the frontend migration phase. Do not remove the old tables yet.  
**Affected Area:** Codebase — all consumers identified in TASK 3.5.  
**Validation Required:** No active consumer still reads from the five tables without a corresponding migration plan.  
**Dependencies:** TASK 3.5.

---

### TASK 3.7

**Phase:** 3  
**Objective:** Drop `product_badges` table.  
**Exact Change:** After confirming no active references remain (TASK 3.6), drop the `product_badges` table. No replacement column or abstraction is created.  
**Affected Area:** Database schema — `product_badges`.  
**Validation Required:** `product_badges` no longer exists. No application error is produced from its absence.  
**Dependencies:** TASK 3.6.

---

### TASK 3.8

**Phase:** 3  
**Objective:** Drop `product_related` table.  
**Exact Change:** After confirming no active references remain (TASK 3.6), drop the `product_related` table. No replacement table or column is created.  
**Affected Area:** Database schema — `product_related`.  
**Validation Required:** `product_related` no longer exists. No application error is produced from its absence.  
**Dependencies:** TASK 3.6.

---

### TASK 3.9

**Phase:** 3  
**Objective:** Drop `product_highlights` table.  
**Exact Change:** After confirming no active references remain and data is migrated (TASK 3.2, TASK 3.6), drop `product_highlights`.  
**Affected Area:** Database schema — `product_highlights`.  
**Validation Required:** `product_highlights` no longer exists. Highlight data is correctly served from `products.highlights`.  
**Dependencies:** TASK 3.2, TASK 3.6.

---

### TASK 3.10

**Phase:** 3  
**Objective:** Drop `product_includes` table.  
**Exact Change:** After confirming no active references remain and data is migrated (TASK 3.3, TASK 3.6), drop `product_includes`.  
**Affected Area:** Database schema — `product_includes`.  
**Validation Required:** `product_includes` no longer exists. Includes data is correctly served from `products.includes`.  
**Dependencies:** TASK 3.3, TASK 3.6.

---

### TASK 3.11

**Phase:** 3  
**Objective:** Drop `product_specs` table.  
**Exact Change:** After confirming no active references remain and data is migrated (TASK 3.4, TASK 3.6), drop `product_specs`.  
**Affected Area:** Database schema — `product_specs`.  
**Validation Required:** `product_specs` no longer exists. Specs data is correctly served from `products.specs`.  
**Dependencies:** TASK 3.4, TASK 3.6.

---

### TASK 3.12

**Phase:** 3  
**Objective:** Confirm all relational foreign keys on tables dependent on `products` use UUID `product_id`.  
**Exact Change:** Inspect `cart_items`, `wishlist_items`, `product_images`, `product_reviews`, `offer_products`, `order_items`. Confirm every `product_id` column is a UUID foreign key to `products.id`. Identify and document any column using SKU, slug, or string-based product reference.  
**Affected Area:** Database schema — all tables with `product_id`.  
**Validation Required:** Written confirmation that every `product_id` is a UUID FK or a documented plan for the ones that are not (to be addressed in Phase 4).  
**Dependencies:** TASK 1.1.

---

## PHASE 4 — VARIATION MODEL MIGRATION

---

### TASK 4.1

**Phase:** 4  
**Objective:** Confirm that every current variant record is stored as a complete `products` row.  
**Exact Change:** Audit existing variant data. For any variant whose data lives only in `product_variants` columns rather than as its own `products` row, document what data must be migrated. If migration is needed, create the missing `products` rows with full product data.  
**Affected Area:** Database data — `products`, `product_variants`.  
**Validation Required:** Every variation has a complete, independent `products` row. `product_variants` only holds relationship data (`parent_product_id`, `product_id`, variation attributes, ordering).  
**Dependencies:** TASK 1.2, TASK 3.12.

---

### TASK 4.2

**Phase:** 4  
**Objective:** Remove data-storage columns from `product_variants` that belong on `products`.  
**Exact Change:** After confirming data has been migrated to `products` rows (TASK 4.1), remove columns from `product_variants` that duplicate or override product data (e.g. `in_stock`, price overrides, or any other variant-specific data columns that now live on `products`). Retain only relationship/grouping columns.  
**Affected Area:** Database schema — `product_variants` table.  
**Validation Required:** `product_variants` contains only relationship and ordering columns. No product data fields remain.  
**Dependencies:** TASK 4.1.

---

### TASK 4.3

**Phase:** 4  
**Objective:** Confirm `product_variants` foreign keys are UUID references to `products.id`.  
**Exact Change:** Inspect `product_variants.parent_product_id` and `product_variants.product_id`. Confirm both are UUID foreign keys to `products.id`. Correct any non-UUID reference.  
**Affected Area:** Database schema — `product_variants`.  
**Validation Required:** Both FK columns reference `products.id` with UUID type and proper ON DELETE behavior.  
**Dependencies:** TASK 4.2.

---

### TASK 4.4

**Phase:** 4  
**Objective:** Confirm that `cart_items`, `order_items`, and `product_reviews` store the actual variant product UUID — not the parent product UUID.  
**Exact Change:** Audit any cart, order, or review records where a variation was purchased or reviewed. Confirm the stored `product_id` is the UUID of the actual child/variant product, not the parent family product. Document any records that are incorrect.  
**Affected Area:** Database data — `cart_items`, `order_items`, `product_reviews`.  
**Validation Required:** Written confirmation that actual product UUIDs (child products) are stored, not parent UUIDs for variant records.  
**Dependencies:** TASK 4.1.

---

### TASK 4.5

**Phase:** 4  
**Objective:** Confirm there is no runtime parent-field inheritance in any existing database function or query.  
**Exact Change:** Search database functions and application query layers for any pattern that reads a child product field and falls back to the parent product's field (i.e. `COALESCE(variant.field, parent.field)` or equivalent logic). Document every occurrence. These must be removed — not replaced with a different inheritance pattern.  
**Affected Area:** Database functions, Worker service queries, frontend queries.  
**Validation Required:** Written list of all inheritance patterns found, with confirmation each will be removed (not replaced) in the appropriate phase.  
**Dependencies:** TASK 4.1.

---

## PHASE 5 — INVENTORY REWRITE

---

### TASK 5.1

**Phase:** 5  
**Objective:** Add `stock >= 0` database constraint to `products.stock`.  
**Exact Change:** Add a CHECK constraint `stock >= 0` to `products.stock`. Ensure the column type is a non-negative integer. Before adding the constraint, identify and resolve any existing negative or NULL stock values that would violate it (set to 0 if the product is currently out of stock; explicitly decide and document the NULL case for parent-family non-sellable products).  
**Affected Area:** Database schema — `products.stock`.  
**Validation Required:** Attempting to set `products.stock` to a negative value is rejected by the database. Constraint is present in schema.  
**Dependencies:** TASK 1.1.

---

### TASK 5.2

**Phase:** 5  
**Objective:** Remove `product_variants.in_stock` boolean column.  
**Exact Change:** After confirming inventory authority has moved to `products.stock` (TASK 5.1) and no active consumer references `product_variants.in_stock` (audit required), drop the `in_stock` column from `product_variants`.  
**Affected Area:** Database schema — `product_variants.in_stock`.  
**Validation Required:** Column no longer exists. No application error from its absence.  
**Dependencies:** TASK 4.2, TASK 5.1.

---

### TASK 5.3

**Phase:** 5  
**Objective:** Remove independently editable `products.availability` enum column.  
**Exact Change:** After confirming all consumers have been updated to derive availability from `is_active`, `is_preorder`, and `stock` (audit required), drop or nullify the `availability` column from `products`. If the column is currently used by frontend queries, document the dependency for Phase 12 migration.  
**Affected Area:** Database schema — `products.availability`.  
**Validation Required:** The `availability` column is removed. Availability is derived by consumers from `is_active`, `is_preorder`, and `stock`.  
**Dependencies:** TASK 5.1, TASK 1.1.

---

### TASK 5.4

**Phase:** 5  
**Objective:** Confirm that parent family products (products that have child variants) are not treated as sellable inventory units.  
**Exact Change:** Identify the mechanism by which the system distinguishes a parent family product from a standalone sellable product. Confirm (or implement) that any purchase flow, cart validation, or inventory check correctly rejects adding a parent family product to the cart directly when it has child variants.  
**Affected Area:** Database logic / Worker validation — product purchasability checks.  
**Validation Required:** Attempting to add a parent family product (which has variants) to the cart is rejected. Only actual child products can be added.  
**Dependencies:** TASK 4.1, TASK 5.1.

---

## PHASE 6 — CART INTEGRITY

---

### TASK 6.1

**Phase:** 6  
**Objective:** Add `quantity >= 1` database CHECK constraint to `cart_items.quantity`.  
**Exact Change:** Add a CHECK constraint `quantity >= 1` to `cart_items.quantity`. Before adding, identify any existing rows with `quantity < 1` and remove or correct them.  
**Affected Area:** Database schema — `cart_items.quantity`.  
**Validation Required:** Attempting to set `cart_items.quantity` to 0 or a negative value is rejected by the database.  
**Dependencies:** TASK 1.6.

---

### TASK 6.2

**Phase:** 6  
**Objective:** Add a practical maximum quantity CHECK constraint to `cart_items.quantity`.  
**Exact Change:** Decide the exact business maximum quantity (must be documented and applied consistently). Add a CHECK constraint `quantity <= [decided maximum]` to `cart_items.quantity`.  
**Affected Area:** Database schema — `cart_items.quantity`.  
**Validation Required:** Attempting to set `cart_items.quantity` above the maximum is rejected by the database. The exact maximum value is documented.  
**Dependencies:** TASK 6.1.

---

### TASK 6.3

**Phase:** 6  
**Objective:** Add application-layer quantity validation in the Worker matching the database constraints.  
**Exact Change:** In the Worker's order/cart validation layer, add input validation that rejects `quantity < 1` and `quantity > [decided maximum]` before the request reaches the database. Return a `VALIDATION_*` error using the global error contract.  
**Affected Area:** Worker — order/cart validation.  
**Validation Required:** Worker rejects out-of-range quantities with a clear validation error before any database call.  
**Dependencies:** TASK 6.2.

---

### TASK 6.4

**Phase:** 6  
**Objective:** Confirm all `cart_items` records reference actual product UUIDs.  
**Exact Change:** Inspect `cart_items.product_id`. Confirm it is a UUID foreign key to `products.id`. Confirm it stores the actual child product UUID for variant items (not the parent UUID). Remove any slug or SKU-based cart references if found.  
**Affected Area:** Database schema/data — `cart_items`.  
**Validation Required:** `cart_items.product_id` is a UUID FK to `products.id`. No non-UUID product reference exists.  
**Dependencies:** TASK 4.4.

---

## PHASE 7 — CHECKOUT AND ORDER REWRITE

---

### TASK 7.1

**Phase:** 7  
**Objective:** Implement the authoritative checkout summary endpoint in the Worker.  
**Exact Change:** Create a Worker endpoint that, given an authenticated user's JWT, resolves the user's current cart items, actual product data for each item, current prices, applicable discounts, shipping, current stock availability, and authoritative subtotal and total. Returns a structured summary. The frontend displays this summary and does not calculate any totals.  
**Affected Area:** Worker — orders or checkout route/service.  
**Validation Required:** Endpoint returns accurate authoritative totals matching what the database currently holds. Frontend receives summary without performing any calculations.  
**Dependencies:** TASK 4.4, TASK 5.1, TASK 6.4.

---

### TASK 7.2

**Phase:** 7  
**Objective:** Implement the minimal create-order request contract in the Worker.  
**Exact Change:** The Worker's order creation endpoint must accept only `address_id` and `idempotency_key` from the request body. User identity must be derived from the verified JWT. Any request body field attempting to supply `user_id`, price, subtotal, shipping, total, stock, product name, SKU, or slug must be ignored or rejected.  
**Affected Area:** Worker — orders route/service validation.  
**Validation Required:** Sending a request body with fabricated price or user_id has no effect on the order. The stored order reflects server-calculated values only.  
**Dependencies:** TASK 7.1.

---

### TASK 7.3

**Phase:** 7  
**Objective:** Implement user-scoped idempotency for order creation.  
**Exact Change:** In the order creation database transaction, implement idempotency check: if the same `(user_id, idempotency_key)` pair already exists in a completed order, return that order. If the same key is reused with materially different order data, reject it with an `ORDER_*` error. Do not silently bind one key to a different order state.  
**Affected Area:** Database transaction — order creation function.  
**Validation Required:** Retrying the same request returns the existing order. Reusing the key with different data is rejected.  
**Dependencies:** TASK 7.2.

---

### TASK 7.4

**Phase:** 7  
**Objective:** Implement atomic inventory row locking in the order creation transaction.  
**Exact Change:** Inside the order creation database transaction, after loading cart items and resolving products, use `SELECT ... FOR UPDATE` on every product row involved in the order to lock inventory. Locking must occur before stock validation and decrement.  
**Affected Area:** Database transaction — order creation function.  
**Validation Required:** Concurrent order creation attempts for the same product serialize correctly. The second concurrent request does not see stale stock values.  
**Dependencies:** TASK 7.3.

---

### TASK 7.5

**Phase:** 7  
**Objective:** Implement authoritative price calculation and stock validation inside the order transaction.  
**Exact Change:** Inside the transaction, after locking rows, calculate authoritative current prices from the product records and applicable offers. Validate that each cart item's product is purchasable (`is_active = true`, `is_preorder = false OR preorder purchasing is allowed`, `stock >= requested quantity`). If any product fails validation, roll back and return the appropriate `INVENTORY_*` or `ORDER_*` error.  
**Affected Area:** Database transaction — order creation function.  
**Validation Required:** An order with an out-of-stock product is rejected. An order with a deactivated product is rejected. Authoritative price is used regardless of what price the frontend previously showed.  
**Dependencies:** TASK 7.4.

---

### TASK 7.6

**Phase:** 7  
**Objective:** Implement price-change detection and rejection in the order flow.  
**Exact Change:** If the authoritative total calculated inside the transaction differs from the amount previously confirmed by the user (passed from the checkout summary step), the transaction must roll back and return a specific price-change error (`ORDER_PRICE_CHANGED` or equivalent) along with the updated authoritative amounts. The user must explicitly confirm the new amount before re-submitting.  
**Affected Area:** Database transaction and Worker — order creation function and response handling.  
**Validation Required:** If a price changes between checkout summary and order creation, the order is not created and the client receives the updated authoritative totals with a specific error code.  
**Dependencies:** TASK 7.5.

---

### TASK 7.7

**Phase:** 7  
**Objective:** Implement stock decrement, order creation, order items, initial tracking event, and cart clearing inside the atomic transaction.  
**Exact Change:** Inside the same transaction, after validation passes: decrement `products.stock` for each purchased product by the purchased quantity; insert the `orders` row with the authoritative total; insert `order_items` rows with the actual product UUIDs and authoritative prices; insert the initial `order_events` row (`order_placed`); delete the user's cart items. The entire operation succeeds or rolls back atomically.  
**Affected Area:** Database transaction — order creation function.  
**Validation Required:** After a successful order: stock is decremented correctly; order and items exist; initial event exists; cart is empty. If any step fails, none of them are committed.  
**Dependencies:** TASK 7.5, TASK 7.6.

---

### TASK 7.8

**Phase:** 7  
**Objective:** Implement production-safe `order_number` generation.  
**Exact Change:** Replace the current small random order-number scheme with a production-safe unique scheme (e.g., a sequence-based scheme, a prefixed timestamp + sequence, or a similar approach that guarantees uniqueness at scale). The scheme must be documented. `order_number` must not be used as a foreign key.  
**Affected Area:** Database — `orders.order_number` generation.  
**Validation Required:** New orders receive an `order_number` that is unique and human-readable. No two orders share the same `order_number`.  
**Dependencies:** TASK 1.4.

---

### TASK 7.9

**Phase:** 7  
**Objective:** Implement address ownership validation inside the order transaction.  
**Exact Change:** Inside the transaction, before proceeding, confirm that the `address_id` supplied belongs to the authenticated user (`addresses.user_id = current_user_id`). If the address does not belong to the user, roll back and return an `ORDER_*` error.  
**Affected Area:** Database transaction — order creation function.  
**Validation Required:** An order attempt using another user's `address_id` is rejected.  
**Dependencies:** TASK 7.3.

---

## PHASE 8 — ORDER LIFECYCLE AND TRACKING

---

### TASK 8.1

**Phase:** 8  
**Objective:** Create `order_events` table if it does not exist.  
**Exact Change:** Create the `order_events` table with columns: `id` (UUID PK), `order_id` (UUID FK to `orders.id`), `event_type` (text or enum), `created_at` (timestamptz, default now()), `metadata` (JSONB, nullable). The table is append-only. No UPDATE or DELETE is permitted via RLS or grants for any browser role.  
**Affected Area:** Database schema — `order_events`.  
**Validation Required:** Table exists with correct schema. Browser roles cannot UPDATE or DELETE rows.  
**Dependencies:** TASK 1.5.

---

### TASK 8.2

**Phase:** 8  
**Objective:** Implement the legal status transition enforcement in the database.  
**Exact Change:** Implement a database-level check (CHECK constraint, trigger, or SECURITY DEFINER function) that enforces the legal transition matrix. Legal transitions: `processing → confirmed`, `processing → cancelled`, `confirmed → shipped`, `confirmed → cancelled`, `shipped → out-for-delivery`, `out-for-delivery → delivered`, `delivered → returned`. All other transitions must be rejected.  
**Affected Area:** Database — `orders` table, status transition enforcement.  
**Validation Required:** Attempting `processing → delivered` is rejected. Attempting `cancelled → shipped` is rejected. Attempting `returned → delivered` is rejected. All legal transitions succeed.  
**Dependencies:** TASK 8.1, TASK 1.4, TASK 1.5.

---

### TASK 8.3

**Phase:** 8  
**Objective:** Ensure every status change also inserts an `order_events` row in the same transaction.  
**Exact Change:** Implement the status change mechanism (function or trigger) so that `UPDATE orders SET status = new_state` and `INSERT INTO order_events(order_id, event_type)` always happen in the same transaction. They must not be separable.  
**Affected Area:** Database — status transition function/trigger.  
**Validation Required:** Changing an order's status always results in a corresponding event row. There is no order status change without a matching event row.  
**Dependencies:** TASK 8.2.

---

### TASK 8.4

**Phase:** 8  
**Objective:** Implement cancellation with idempotent stock restoration.  
**Exact Change:** Implement the cancellation transition function. When `processing → cancelled` or `confirmed → cancelled`: restore `products.stock` by the purchased quantity for each order item. Stock restoration must be idempotent — if the order is already cancelled, a second invocation must not restore stock again. Set `orders.status = 'cancelled'` and insert the cancellation event in the same transaction.  
**Affected Area:** Database — cancellation function/transition.  
**Validation Required:** Cancelling an order restores inventory. Cancelling the same order twice does not double-restore inventory. Cancellation and stock restoration are atomic.  
**Dependencies:** TASK 8.3, TASK 5.1.

---

### TASK 8.5

**Phase:** 8  
**Objective:** Implement the `delivered → returned` transition without automatic stock restoration.  
**Exact Change:** Implement the `delivered → returned` transition. Set `orders.status = 'returned'` and insert the return event in the same transaction. Do NOT restore stock automatically. Stock restoration for returns belongs to a future inventory/admin system.  
**Affected Area:** Database — return transition function.  
**Validation Required:** Returned order has `status = 'returned'` and a return event. `products.stock` is unchanged by the return.  
**Dependencies:** TASK 8.3.

---

### TASK 8.6

**Phase:** 8  
**Objective:** Confirm customer read-only access to order status and events.  
**Exact Change:** Review RLS policies on `orders` and `order_events`. Confirm that authenticated users can read their own orders and events but cannot UPDATE `orders.status` or INSERT/UPDATE/DELETE `order_events`. Apply corrections.  
**Affected Area:** Database — RLS on `orders` and `order_events`.  
**Validation Required:** An authenticated user can read their own order status and event history. They cannot mutate order status or insert events.  
**Dependencies:** TASK 8.1, TASK 8.3.

---

## PHASE 9 — WORKER STRUCTURE

---

### TASK 9.1

**Phase:** 9  
**Objective:** Confirm `dev.ts` is genuinely unused and remove it.  
**Exact Change:** Search the entire Worker codebase for any import or reference to `dev.ts`. If no reference exists, delete the file. If a reference exists, document it; do not delete until the reference is resolved.  
**Affected Area:** Worker — `dev.ts`.  
**Validation Required:** `dev.ts` is deleted and Worker builds/starts without error.  
**Dependencies:** None.

---

### TASK 9.2

**Phase:** 9  
**Objective:** Reorganize Worker source into the target responsibility-based directory structure.  
**Exact Change:** Create the directory structure: `config/`, `http/`, `infrastructure/`, `security/`, `registration/`, `account/`, `orders/`. Move existing files into their correct responsibility directory. Do not create meaningless wrappers. Only create a file if there is real logic to place in it.  
**Affected Area:** Worker — entire `src/` directory structure.  
**Validation Required:** Worker builds and all routes function correctly after reorganization.  
**Dependencies:** TASK 9.1.

---

### TASK 9.3

**Phase:** 9  
**Objective:** Move the global error system out of the auth module and into `http/errors.ts`.  
**Exact Change:** The existing auth-specific error definitions must be relocated to `src/http/errors.ts` as a global system. All modules must import errors from this single location. Do not leave a parallel auth-specific error system in place.  
**Affected Area:** Worker — error definitions and all importing modules.  
**Validation Required:** A single global error source exists at `http/errors.ts`. No parallel auth-specific error map remains.  
**Dependencies:** TASK 9.2.

---

### TASK 9.4

**Phase:** 9  
**Objective:** Remove fake middleware wrappers and dead pass-through abstractions.  
**Exact Change:** Identify any Worker middleware or abstraction layer that performs no real work (pure pass-throughs, no-op wrappers, redundant re-exports). Remove them. Do not remove correct authentication logic.  
**Affected Area:** Worker — middleware and abstraction layers.  
**Validation Required:** Removed abstractions do not cause any route failure. Worker builds and all routes function correctly.  
**Dependencies:** TASK 9.2.

---

### TASK 9.5

**Phase:** 9  
**Objective:** Remove duplicate email normalization logic.  
**Exact Change:** Identify all locations in the Worker that normalize email addresses. Consolidate into a single canonical location (within the appropriate responsibility module). Remove all duplicates.  
**Affected Area:** Worker — email normalization across modules.  
**Validation Required:** Email normalization happens in exactly one place. All callers use that single location.  
**Dependencies:** TASK 9.2.

---

### TASK 9.6

**Phase:** 9  
**Objective:** Remove redundant error mapping code.  
**Exact Change:** Identify any error mapping code that is now superseded by the global error system (TASK 9.3) or that duplicates error definitions. Remove the redundant code.  
**Affected Area:** Worker — error handling across modules.  
**Validation Required:** No duplicate error maps exist. All Worker errors use the global contract.  
**Dependencies:** TASK 9.3.

---

## PHASE 10 — RATE LIMITING

---

### TASK 10.1

**Phase:** 10  
**Objective:** Migrate the rate-limit table to the structured schema.  
**Exact Change:** Replace the current rate-limit table structure with: `action` (text), `dimension` (text: `ip`, `email`, or `user`), `subject_hash` (text — HMAC/hash of the subject, not raw value), `created_at` (timestamptz). Add appropriate indexes for efficient cleanup and lookup queries. Migrate or discard existing rate-limit records (existing records can be discarded as they are ephemeral abuse-prevention state).  
**Affected Area:** Database schema — rate-limit table.  
**Validation Required:** New table structure exists. Old concatenated-key columns are gone. No raw email or IP is stored in the new table.  
**Dependencies:** TASK 1.8, TASK 2.5.

---

### TASK 10.2

**Phase:** 10  
**Objective:** Implement rate-limit enforcement for registration — IP dimension.  
**Exact Change:** Implement the check: IP — 5 attempts per 15 minutes for the `register` action. The subject is the HMAC of the IP address. Use the `check_rate_limit` RPC (service-role only). Return `RATE_LIMIT_*` error on violation.  
**Affected Area:** Worker — registration rate-limit enforcement.  
**Validation Required:** A sixth registration attempt from the same IP within 15 minutes is rejected with the correct rate-limit error.  
**Dependencies:** TASK 10.1, TASK 2.2.

---

### TASK 10.3

**Phase:** 10  
**Objective:** Implement rate-limit enforcement for registration — email dimension.  
**Exact Change:** Implement the check: email — 3 attempts per 15 minutes for the `register` action. The subject is the HMAC of the normalized email address. Return `RATE_LIMIT_*` error on violation.  
**Affected Area:** Worker — registration rate-limit enforcement.  
**Validation Required:** A fourth registration attempt with the same email within 15 minutes is rejected with the correct rate-limit error.  
**Dependencies:** TASK 10.1, TASK 2.2.

---

### TASK 10.4

**Phase:** 10  
**Objective:** Implement rate-limit enforcement for OTP resend — email and IP dimensions.  
**Exact Change:** Implement: email — 3 OTP resend attempts per 24 hours; IP — short burst protection (exact value decided during implementation and documented). Return `RATE_LIMIT_*` error on violation.  
**Affected Area:** Worker — OTP resend rate-limit enforcement.  
**Validation Required:** Fourth OTP resend from the same email within 24 hours is rejected. IP burst protection triggers on rapid repeated OTP requests from the same IP.  
**Dependencies:** TASK 10.1, TASK 2.2.

---

### TASK 10.5

**Phase:** 10  
**Objective:** Implement rate-limit enforcement for password reset — email and IP dimensions, plus successful reset cooldown.  
**Exact Change:** Implement: email — 1 password reset attempt per 24 hours; IP — 3 password reset attempts per 24 hours; successful reset — 24-hour cooldown before the same email can request another reset. Return `RATE_LIMIT_*` error on violation.  
**Affected Area:** Worker — password reset rate-limit enforcement.  
**Validation Required:** A second password reset attempt from the same email within 24 hours is rejected. A second attempt from the same IP beyond the limit is rejected. After a successful reset, another attempt within 24 hours is rejected.  
**Dependencies:** TASK 10.1, TASK 2.2.

---

### TASK 10.6

**Phase:** 10  
**Objective:** Implement rate-limit enforcement for order creation — user and IP dimensions.  
**Exact Change:** Implement: user — 5 order creation attempts per 15 minutes; IP — short burst protection (exact value decided during implementation and documented). Return `RATE_LIMIT_*` error on violation.  
**Affected Area:** Worker — order creation rate-limit enforcement.  
**Validation Required:** A sixth order creation attempt from the same user within 15 minutes is rejected. IP burst protection triggers on rapid repeated order attempts from the same IP.  
**Dependencies:** TASK 10.1, TASK 2.2.

---

### TASK 10.7

**Phase:** 10  
**Objective:** Confirm no device fingerprinting data is collected anywhere in the rate-limiting system.  
**Exact Change:** Audit the entire rate-limiting implementation for any collection of: screen size, GPU, browser fingerprint, canvas fingerprint, timezone fingerprint, device model fingerprint, font fingerprint. Remove any such collection if found.  
**Affected Area:** Worker and frontend — rate-limiting code paths.  
**Validation Required:** No fingerprinting data is collected. Rate limiting operates exclusively on action + dimension (IP, email hash, user UUID).  
**Dependencies:** TASK 10.1 through TASK 10.6.

---

## PHASE 11 — GLOBAL ERROR CONTRACT

---

### TASK 11.1

**Phase:** 11  
**Objective:** Finalize the global error contract shape and ensure it is the single source for all Worker errors.  
**Exact Change:** Confirm `src/http/errors.ts` (from TASK 9.3) defines the contract `{ code, message, status }`. Ensure every Worker route and service uses this contract for all error responses. Verify the defined error group prefixes are present: `AUTH_*`, `REGISTRATION_*`, `OTP_*`, `PASSWORD_RESET_*`, `ORDER_*`, `INVENTORY_*`, `VALIDATION_*`, `RATE_LIMIT_*`, `INTERNAL_*`.  
**Affected Area:** Worker — `src/http/errors.ts` and all modules.  
**Validation Required:** Every Worker error response has the shape `{ code, message, status }`. No module uses a different error shape.  
**Dependencies:** TASK 9.3.

---

### TASK 11.2

**Phase:** 11  
**Objective:** Remove any separate inline error map used specifically for order errors.  
**Exact Change:** Locate any order-specific inline error map or error code set that lives outside `src/http/errors.ts`. Move any needed order error codes into the global system. Remove the separate map.  
**Affected Area:** Worker — orders module error handling.  
**Validation Required:** Order errors use the global contract. No separate order error map exists.  
**Dependencies:** TASK 11.1.

---

### TASK 11.3

**Phase:** 11  
**Objective:** Confirm the frontend displays only `error.message` from Worker error responses.  
**Exact Change:** Audit frontend error-handling code for any location that displays `error.code`, `error.status`, Supabase error messages, SQL messages, or stack traces to the user. Replace all such locations with `toast.error(error.message)` or equivalent display of only the `message` field.  
**Affected Area:** Frontend — all error-handling UI paths.  
**Validation Required:** No internal error detail (code, status, SQL message, stack trace) is ever displayed to the user.  
**Dependencies:** TASK 11.1.

---

## PHASE 12 — FRONTEND MIGRATION

---

### TASK 12.1

**Phase:** 12  
**Objective:** Migrate product page to use embedded metadata fields.  
**Exact Change:** Update the product page query to read `highlights`, `includes`, and `specs` from `products` directly. Remove all queries to `product_highlights`, `product_includes`, and `product_specs`. Remove all queries to `product_badges`. Derive badge-like states (sale, preorder, out-of-stock, low-stock, new) from authoritative product/offer fields.  
**Affected Area:** Frontend — product page component and data layer.  
**Validation Required:** Product page renders highlights, includes, and specs from embedded fields. No query to the removed tables is made.  
**Dependencies:** TASK 3.9, TASK 3.10, TASK 3.11, TASK 3.7.

---

### TASK 12.2

**Phase:** 12  
**Objective:** Migrate product page variation selection to use actual product UUIDs.  
**Exact Change:** Update variation selection logic on the product page to resolve the selected variation to the actual child product UUID. The selected child product's own price, stock, images, SKU, and product-specific data must be displayed. No runtime parent-field inheritance. No slug-based compatibility logic.  
**Affected Area:** Frontend — product page variation selector.  
**Validation Required:** Selecting a variation loads and displays that child product's own data. Parent product data is not shown for child-specific fields.  
**Dependencies:** TASK 4.1, TASK 4.5.

---

### TASK 12.3

**Phase:** 12  
**Objective:** Migrate the cart to store and reference actual product UUIDs.  
**Exact Change:** Confirm the cart stores the actual product UUID for every item (including variant selections). Update any cart query or mutation that uses slug, SKU, or parent product ID as the cart item identifier. Ensure cart display loads product data by UUID.  
**Affected Area:** Frontend — cart page and cart state management.  
**Validation Required:** Cart items reference actual product UUIDs. Cart displays accurate product names, prices, and stock for each item by UUID.  
**Dependencies:** TASK 6.4.

---

### TASK 12.4

**Phase:** 12  
**Objective:** Migrate the wishlist to reference actual product UUIDs.  
**Exact Change:** Confirm `wishlist_items.product_id` is a UUID FK. Update any wishlist query or mutation that uses slug or SKU. Ensure wishlist display loads product data by UUID.  
**Affected Area:** Frontend — wishlist component and data layer.  
**Validation Required:** Wishlist items reference actual product UUIDs. No slug or SKU is used as a relational reference.  
**Dependencies:** TASK 3.12.

---

### TASK 12.5

**Phase:** 12  
**Objective:** Migrate checkout to consume the authoritative checkout summary and send the minimal create-order payload.  
**Exact Change:** Update checkout to call the authoritative checkout summary endpoint (TASK 7.1) and display the returned summary. Update the order submission to send only `address_id` and `idempotency_key`. Remove any frontend-calculated totals, prices, or stock assumptions from the submit payload.  
**Affected Area:** Frontend — checkout page and order submission logic.  
**Validation Required:** Checkout page displays server-returned totals. Order submission sends only the minimum required fields. No frontend-calculated amount is submitted.  
**Dependencies:** TASK 7.1, TASK 7.2.

---

### TASK 12.6

**Phase:** 12  
**Objective:** Migrate order screens to use the new lifecycle status values.  
**Exact Change:** Update all order status display logic to reflect the final lifecycle: `processing`, `confirmed`, `shipped`, `out-for-delivery`, `delivered`, `cancelled`, `returned`. Remove references to any removed or renamed status values. Display appropriate UI labels for each state.  
**Affected Area:** Frontend — order list, order detail pages.  
**Validation Required:** All lifecycle states are displayed correctly. No reference to removed status values remains.  
**Dependencies:** TASK 8.2.

---

### TASK 12.7

**Phase:** 12  
**Objective:** Migrate order tracking display to use `order_events` history.  
**Exact Change:** Update the order tracking UI to read from `order_events` for the timeline/history display. Display event types as human-readable tracking milestones. Ensure `packed` event type renders correctly even though it is not a primary order status value.  
**Affected Area:** Frontend — order tracking/timeline component.  
**Validation Required:** Order tracking timeline is built from `order_events` rows. Events display in chronological order with appropriate labels.  
**Dependencies:** TASK 8.1, TASK 8.3.

---

### TASK 12.8

**Phase:** 12  
**Objective:** Migrate review write and read flows to use actual `product_id` UUIDs.  
**Exact Change:** Update review submission to write `product_id` as the actual product UUID of the purchased item. Update review display on product pages to read reviews by `product_id` UUID. A product-family page may aggregate reviews across child product UUIDs, but the stored `product_id` on each review must remain the actual purchased product UUID.  
**Affected Area:** Frontend — review form, review display, product page reviews section.  
**Validation Required:** Reviews are stored and queried by UUID `product_id`. Review aggregation on family pages is additive display only — it does not rewrite stored `product_id`.  
**Dependencies:** TASK 1.7, TASK 4.4.

---

### TASK 12.9

**Phase:** 12  
**Objective:** Migrate related product rendering to consume algorithm results.  
**Exact Change:** Remove all reads from `product_related`. Update the related products section of the product page to call the algorithm-driven related products query/function (implemented in Phase 3 or as part of this task). Display top 4–8 results. Never show multiple variations from the same family as distinct results.  
**Affected Area:** Frontend — related products section, product page.  
**Validation Required:** Related products section displays algorithm-driven results. No query to `product_related` is made. Multiple variants of the same family do not appear as distinct related products.  
**Dependencies:** TASK 3.8, TASK 4.1.

---

## PHASE 13 — SEED AND VERIFICATION

---

### TASK 13.1

**Phase:** 13  
**Objective:** Rewrite seed data for the new schema.  
**Exact Change:** Create a new seed file (or rewrite the existing one) that includes: simple standalone products; parent/variation families with complete independent variant product records; out-of-stock products (`stock = 0`); low-stock products (stock below threshold); preorder products (`is_preorder = true`); active offers linked to products by UUID; product reviews with valid `product_id` and `user_id` UUIDs; delivered orders with full `order_items` using actual product UUIDs; orders in different lifecycle states (processing, confirmed, shipped, delivered, cancelled); realistic `order_events` rows matching each order's lifecycle; product families with strong related-product candidates; product families with fallback related-product candidates (fewer shared signals).  
Do not seed: `product_highlights`, `product_includes`, `product_specs`, `product_badges`, `product_related`, or circulation ranking tables.  
**Affected Area:** Seed file(s).  
**Validation Required:** Seeding completes without error. All seed data is queryable from the final schema. No reference to removed tables.  
**Dependencies:** All Phase 3–12 tasks.

---

### TASK 13.2

**Phase:** 13  
**Objective:** Run schema integrity verification.  
**Exact Change:** Confirm: `products` has UUID PK, `sku`, `slug`, `highlights`, `includes`, `specs`, `is_active`, `is_preorder`, `stock >= 0` constraint. Confirm removed tables (`product_highlights`, `product_includes`, `product_specs`, `product_badges`, `product_related`) no longer exist. Confirm `circulation_entries` and `circulation_versions` are untouched. Confirm `product_variants` is relationship-only. Confirm `order_events` exists with correct schema.  
**Affected Area:** Database schema.  
**Validation Required:** All schema checks pass. No unexpected table or column is present or absent.  
**Dependencies:** TASK 13.1.

---

### TASK 13.3

**Phase:** 13  
**Objective:** Run permissions and RLS verification.  
**Exact Change:** Verify: `check_rate_limit` not executable by browser roles; `create_order` not executable by browser roles; `rate_limit` and `signup_authorizations` not directly accessible by browser roles; `order_events` not mutable by browser roles; `orders.status` not directly mutable by browser roles; `products.stock` not directly mutable by browser roles.  
**Affected Area:** Database — RLS policies and grants.  
**Validation Required:** All permission checks pass. Every boundary identified in Phase 2 is enforced.  
**Dependencies:** TASK 13.2.

---

### TASK 13.4

**Phase:** 13  
**Objective:** Run inventory and concurrency verification.  
**Exact Change:** Test: placing an order decrements stock correctly; stock never goes below 0; two concurrent orders for the same last-unit product result in exactly one success and one rejection; cancellation restores stock exactly once; double cancellation does not double-restore stock.  
**Affected Area:** Database — inventory integrity.  
**Validation Required:** All inventory tests pass.  
**Dependencies:** TASK 13.3.

---

### TASK 13.5

**Phase:** 13  
**Objective:** Run idempotency and pricing verification.  
**Exact Change:** Test: retrying the same order request returns the existing order without creating a duplicate; reusing an idempotency key with different data is rejected; if price changes between checkout summary and order creation, the order is rejected with the price-change error and updated totals; the authoritative total in the created order matches the database-calculated total.  
**Affected Area:** Database — order creation logic.  
**Validation Required:** All idempotency and pricing tests pass.  
**Dependencies:** TASK 13.4.

---

### TASK 13.6

**Phase:** 13  
**Objective:** Run lifecycle transition verification.  
**Exact Change:** Test all legal transitions succeed. Test all illegal transitions are rejected: `processing → delivered`, `delivered → processing`, `cancelled → shipped`, `returned → delivered`, and any other non-listed transition. Test that every status change produces a matching `order_events` row in the same transaction.  
**Affected Area:** Database — order lifecycle.  
**Validation Required:** All legal transitions pass. All illegal transitions are rejected. Every transition produces an event.  
**Dependencies:** TASK 13.5.

---

### TASK 13.7

**Phase:** 13  
**Objective:** Run review eligibility verification.  
**Exact Change:** Test: a user can submit a review for a product they purchased and which has been delivered; a user cannot review a product they did not purchase; a user cannot review a product from an order that is not yet delivered; the stored review contains the actual purchased `product_id`.  
**Affected Area:** Database and frontend — review eligibility.  
**Validation Required:** All review eligibility tests pass.  
**Dependencies:** TASK 13.6.

---

### TASK 13.8

**Phase:** 13  
**Objective:** Run related product algorithm verification.  
**Exact Change:** Test: algorithm returns 4–8 candidates; current product's family is excluded; inactive and unavailable products are excluded; multiple variants from the same family do not appear as distinct results; scoring correctly prioritizes same-subcategory, same-category, same-brand candidates; deterministic secondary ordering produces stable results across repeated calls.  
**Affected Area:** Database — related product algorithm function.  
**Validation Required:** All related product algorithm tests pass.  
**Dependencies:** TASK 13.6.

---

### TASK 13.9

**Phase:** 13  
**Objective:** Run rate-limit enforcement verification.  
**Exact Change:** Test all rate-limit policies: registration IP limit; registration email limit; OTP resend email limit; OTP resend IP burst limit; password reset email limit; password reset IP limit; successful reset cooldown; order creation user limit; order creation IP burst limit. Confirm no fingerprinting data is involved.  
**Affected Area:** Worker and database — rate-limiting.  
**Validation Required:** All rate-limit policy tests pass.  
**Dependencies:** TASK 13.7.

---

### TASK 13.10

**Phase:** 13  
**Objective:** Run authentication regression verification.  
**Exact Change:** Test the full registration flow end-to-end: Turnstile → Worker → rate limits → signup authorization → Supabase signup → Before User Created Hook → atomic authorization consumption → OTP → verifyOtp → AuthProvider. Confirm no step has been broken by the refactor. Confirm sign-in still works. Confirm password reset still works.  
**Affected Area:** Worker, database, frontend — authentication flows.  
**Validation Required:** Full registration flow succeeds. Sign-in succeeds. Password reset flow succeeds. Before User Created Hook fires. OTP verification uses native Supabase flow.  
**Dependencies:** TASK 13.9.

---

### TASK 13.11

**Phase:** 13  
**Objective:** Remove any remaining stale objects after all verification passes.  
**Exact Change:** After all verification tasks (13.2 through 13.10) pass without error, identify any remaining stale database objects (unused functions, triggers, columns, or indexes that existed before this refactor and were not already removed). For each: confirm no active reference exists; then drop it. Document every object removed.  
**Affected Area:** Database — stale objects.  
**Validation Required:** All identified stale objects are removed. Full verification suite still passes after removal.  
**Dependencies:** TASK 13.2 through TASK 13.10.

---

## Implementation Gate

STOP after creating `implementation.md` and `task.md`. Do not execute any implementation task until explicitly instructed.
