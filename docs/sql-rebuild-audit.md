# SQL rebuild audit

**Scope:** Replace the repository’s fragmented Supabase SQL with one canonical target definition. This document is the pre-change audit required before any repository SQL deletion. It does not authorize destructive changes to the hosted database.

**Audit date:** 2026-08-22  
**Live project inspected:** `onyzjnitnekjhdexecdm` (`xyz414422-code's Project`, `ACTIVE_HEALTHY`, PostgreSQL 17.6)  
**Inspection method:** Supabase MCP, read-only schema/catalog queries; repository SQL and current application, Worker, ProcessingServer, and TrackingServer code.

## 1. Safety decision and rebuild boundary

The linked hosted project is active. Every public business table reported zero rows at inspection time, and `ProcessingServer/src/index.ts` labels its embedded project credentials “TEST PROJECT KEYS — disposable.” This is evidence that the project is a test/development project, but it is not a user confirmation that destructive database work is authorized. Supabase MCP exposes no backup/snapshot creation or backup-status API, so an appropriate snapshot could not be taken or confirmed.

**Decision:** repository cleanup and canonical SQL creation are safe and are performed here. No destructive SQL, migration, seed, reset, branch creation, or schema rebuild is executed against the hosted project. The live project remains unchanged. Before any database rebuild, the operator must (1) confirm the target is disposable or take and verify a backup/PITR snapshot, (2) verify the project ref, (3) apply the staged migration in a non-production clone, and (4) perform the row-count and referential-integrity checks listed in section 15.

The hosted database is materially stale relative to the checked-in phase migrations and current Worker/UI contracts. Its migration history includes an unsafe `full_clean_drop`, then reapplies only legacy 0001–0005 migrations after the later phase migrations. Its live schema consequently still uses product slugs as relational keys, `availability_enum`, legacy variants, `worker_rate_limits`, a text order ID, and the three-argument order RPC. The repository canonical target intentionally does **not** copy that state.

## 2. Current live schema inventory

### Extensions

Installed and required by the target: `extensions.pgcrypto` (1.3), used by the Before User Created authorization hook. The live platform also has Supabase-provided extensions such as `pg_stat_statements`, `uuid-ossp`, and `vault`; they are platform capabilities, not application-owned target dependencies. The target does not use `vector` or introduce a recommendation/vector feature.

### Live public tables

| Object | Current live identity/model | Target disposition |
|---|---|---|
| `categories` | `slug text` primary key; catalog text, `subcategories`, `featured` slug array | Transform to UUID `id` primary key, unique slug, no relational slug arrays. |
| `brands` | `slug text` primary key | Transform to UUID `id` primary key, unique slug. |
| `products` | `slug text` primary key; `brand_slug`, `category_slug`, `availability_enum`, nullable stock | Transform to UUID `id`, `brand_id`, `category_id`, DB-generated `sku`, unique slug, embedded metadata, derived availability. |
| `product_images` | `product_slug` FK | Transform to `product_id uuid` FK. |
| `product_variants` | one product row plus `variant_id`, `name`, `price_delta`, `in_stock` | Replace with parent-product/child-product relationship rows; complete child data remains in `products`. |
| `product_specs`, `product_highlights`, `product_includes` | ordered slug-keyed metadata child tables | Transform data into `products.specs jsonb`, `products.highlights text[]`, and `products.includes text[]`, then remove. |
| `product_badges` | ordered slug-keyed badge table | Remove; no replacement badge data store. |
| `product_related` | stored slug-keyed product links | Remove; use deterministic computed related-product query. |
| `product_reviews` | editorial `product_slug`, author/date/position model | Replace with user UUID/product UUID review model with purchase eligibility and ownership. |
| `offers` | genuine business entity, UUID id | Retain with no badge-system relationship. |
| `offer_products` | `offer_id` + `product_slug` | Transform to `offer_id` + `product_id uuid`. |
| `profiles` | UUID auth-user key, email/contact fields | Retain; `id` is the user identity. |
| `addresses` | UUID id and `user_id` | Retain. |
| `cart_items` | UUID id with `product_slug`, `variant_id`, constrained quantity | Transform to user/product UUID. |
| `wishlist_items` | UUID id with `product_slug` | Transform to user/product UUID. |
| `orders` | text `FG-…` primary key; no separate order number | Transform primary key to UUID and retain an independent unique human-facing `order_number`. |
| `order_items` | text order FK, nullable `product_slug`, snapshots | Transform FKs to UUID while retaining historical name/SKU/price/quantity/total snapshots. |
| `order_timeline` | future placeholder rows and `done` flags | Remove from target; replace history with immutable `order_events`. Current UI still queries it, so this is a required later code deployment dependency. |
| `worker_rate_limits` | RLS disabled, opaque `key` | Replace with RLS-protected `worker_rate_limits(id, action, dimension, subject_hash, created_at)`. |
| `signup_authorizations` | hash-only pre-user state | Retain. |
| `circulation_versions` | ranking/version table | Explicitly untouched. |
| `circulation_entries` | ranking entries with `product_slug` in live DB | Explicitly untouched by this rebuild; current application expects the later UUID `product_id` form, so the existing ranking deployment must be reconciled separately without this SQL layer changing these tables. |

All live public tables reported zero rows. This is a safety observation, not authorization to discard data.

### Live types

Live application types are `availability_enum`, `currency_enum`, `offer_status_enum`, `onboarding_state_enum`, `order_status_enum`, `payment_method_enum`, `payment_status_enum`, `product_visual_key_enum`, and circulation enums. The target retains only the non-obsolete commerce types: `currency_enum`, `offer_status_enum`, `onboarding_state_enum` (including `address_optional`), `order_status_enum`, `payment_method_enum`, `payment_status_enum`, and `product_visual_key_enum`. `availability_enum` is removed because availability derives from `is_active`, `is_preorder`, and `stock`. Circulation enums are untouched and intentionally not redefined by canonical business SQL.

### Live functions, triggers, policies, and grants

* Functions: legacy `check_rate_limit(text,int,int)`, `consume_signup_authorization(text,text)`, legacy `create_order(uuid,uuid,text)`, `handle_new_auth_user()`, `hook_validate_signup_authorization(jsonb)`, and `set_updated_at()`.
* Triggers: `set_updated_at` triggers on categories, brands, products, product_variants, offers, profiles, addresses, cart_items, and orders. The auth trigger `on_auth_user_created` exists on `auth.users` but is outside the public-trigger inventory.
* Policies: public catalog reads; public read for legacy product metadata; ownership policies for profiles/addresses/cart/wishlist/orders/order children; published-only circulation policies. `product_reviews` has only public read in the live database because it is still editorial. `signup_authorizations` has RLS with no browser policies.
* Grants: the live database retains broad default table grants to `anon` and `authenticated`; RLS limits most tables, but `worker_rate_limits` is RLS-disabled. Supabase’s advisor reported this as critical. Browser execute must not be granted on trusted order/rate-limit functions in the target.

## 3. Current repository SQL file inventory

### Existing migration chain

`supabase/migrations/0001_schema.sql` through `0020_remove_stale_objects.sql` contains several generations of the schema. The desired final concepts appear across 0009–0020, but the chain is not a clean source of truth because it starts from a slug-keyed Phase 1 model, contains data repairs and duplicated replacements, and is not aligned to the current live migration ordering.

| Files | Classification |
|---|---|
| `0001_schema.sql` | Obsolete initial schema: slug relational identity, availability column, old variants, metadata tables, badges, related products, text orders, future timeline. |
| `0002_rls_policies.sql` | Obsolete policy set for the initial shape. |
| `0003_orders_idempotency.sql` | Superseded concept incorporated into canonical constraints. |
| `0004_worker_rpc.sql` | Obsolete slug/availability/variant RPC and opaque rate limiter. |
| `0005_signup_authorizations.sql`, `0005b_fix_hook_digest.sql` | Functional security architecture to retain, consolidated into canonical functions/grants. |
| `0006_reviews.sql` through `0008_security_hardening.sql` | Historical migration fragments; their valid end-state is consolidated. |
| `0009_product_schema_migration.sql` through `0014_cart_integrity.sql` | Historical data-model conversion fragments; target end-state is consolidated. |
| `0015_create_order_rewrite.sql` through `0018_cancellation_and_return.sql` | Valid target behavior but split across replacement functions and still includes obsolete `order_timeline` behavior and text order IDs. Consolidated and corrected in canonical functions. |
| `0019_rate_limit_restructure.sql` | Valid target direction but calls the table `rate_limits`, omits ID, and is consolidated under required `worker_rate_limits`. |
| `0020_remove_stale_objects.sql` | Historical cleanup; no longer needed once canonical schema is the source. |

### Root scripts

* `supabase/apply-all.sql`: stale destructive Phase-3 snapshot; recreates old state and must be removed.
* `supabase/apply-idempotency.sql`: duplicate of 0003; remove.
* `supabase/apply-signup-auth.sql`: duplicate of 0005/0005b; remove.
* `supabase/apply-worker-rpc.sql`: duplicate legacy RPC/rate-limit script; remove.
* `supabase/wipe-and-seed.sql`: destructive old-schema rebuild; remove.
* `supabase/seed-auth.sql`: duplicate development auth seed; remove. The canonical schema intentionally does not create `auth.users`; Supabase Auth owns users.
* `supabase/seed.sql`: replace with target business seed. It must not seed or truncate circulation tables.
* `supabase/README.md`: replace because it names stale files and unsafe rebuild directions.

`tidb/schema.sql` and `tidb/seed-events.sql` are separate MySQL/TiDB tracking artifacts and are not part of this Supabase SQL rebuild.

## 4. Current application and Worker consumers

### Frontend/server catalog

`modules/catalog/data.ts`, `modules/catalog/client.ts`, and `modules/catalog/useProducts.ts` already target the later UUID product design for cart/wishlist and child variants. They consume product `id`, `sku`, `slug`, embedded `highlights/includes/specs`, `stock`, `is_preorder`, `is_active`, `product_images.product_id`, `product_variants.parent_product_id/child_product_id`, `offer_products.product_id`, and `circulation_entries.product_id`. They still query `brand_slug` and `category_slug` display/filter columns. The final required architecture instead uses `brand_id` and `category_id`; frontend/server query changes are a later code phase and are not made in this task.

`getRelatedProducts` is currently application-computed from category/subcategory. The canonical SQL supplies an internal deterministic related-product function based on category, subcategory, brand, specs, price, activity/purchasability, family exclusion, and diversity; it does not create a persisted related-products relationship.

### Account, cart, wishlist, reviews, and orders

* `modules/account/index.ts` consumes profiles and addresses using UUID ownership.
* `modules/cart/index.ts` and `modules/wishlist/index.ts` require `(user_id, product_id)` uniqueness and named UUID FKs.
* `modules/review/*` calls `can_review_product(p_product_id uuid)` and writes user/product UUID reviews; it needs public review display with profile name plus ownership/eligibility enforcement.
* `modules/orders/index.ts` reads orders, order items, **legacy `order_timeline`**, and `order_events`. `order_timeline` is incompatible with the target’s immutable-history requirement and must be removed only together with the later UI refactor. This task does not change that code.

### Worker

The current checked-in Worker exists under `worker/src` and is authoritative for internal RPC contracts.

* `worker/src/orders/service.ts` calls service-role-only `create_order(uuid, uuid, text, integer)` with `p_expected_total`, and reads UUID cart/product relations. It expects order UUID and `orderNumber` in the return payload.
* `worker/src/security/rate-limit.ts` calls service-role-only `check_rate_limit(action, dimension, subject_hash, max, window)`. Worker policy, not SQL, defines the exact action windows: registration `ip 5/15m`, `email 3/15m`; resend `email 3/24h`, `ip 5/5m`; password reset `email 1/24h`, `ip 3/24h`, success cooldown `24h`; order creation `user 5/15m`, `ip 10/5m`.
* `worker/src/registration/service.ts` inserts hash-only signup authorization rows and retains native Supabase signup/OTP. It does not call `admin.createUser()`.

### Processing and Tracking services

`TrackingServer` writes only TiDB raw events keyed by tracking slugs and does not access Supabase. `ProcessingServer` owns ranking publication and accesses only `circulation_versions` and `circulation_entries`; it currently writes `product_slug`, while current storefront code expects `product_id`. This is a pre-existing producer/schema mismatch. It must be fixed in a later ProcessingServer deployment by resolving event slugs to UUID product IDs before insertion. This task does **not** alter either protected ranking table or the ProcessingServer.

## 5. Exact target objects retained

Retain as canonical business objects: `categories`, `brands`, `products`, `product_images`, `product_variants`, `offers`, `offer_products`, `profiles`, `addresses`, `cart_items`, `wishlist_items`, `orders`, `order_items`, `order_events`, `product_reviews`, `signup_authorizations`, and `worker_rate_limits`.

Retain these functions, rewritten once: `set_updated_at`, `handle_new_auth_user`, `consume_signup_authorization`, `hook_validate_signup_authorization`, `generate_sku`, `generate_order_number`, `is_legal_order_transition`, `create_order`, `change_order_status`, `cancel_order`, `return_order`, `can_review_product`, `check_rate_limit`, and `get_related_products`.

Retain only these trigger purposes: profile creation after an Auth user insert; `updated_at` maintenance for tables that own `updated_at`; product stock/family invariant enforcement; order-status transition validation; and immutable review enforcement. Order creation, status change, cancellation, return, inventory mutation, and event append remain explicit trusted functions rather than hidden trigger behavior.

## 6. Exact removed and transformed objects

### Removed

`availability_enum`, `products.availability`, `product_highlights`, `product_includes`, `product_specs`, `product_badges`, `product_related`, `product_variants.in_stock`, `product_variants.name`, `product_variants.price_delta`, cart `variant_id`, `order_timeline`, legacy slug-keyed FKs, opaque-key `worker_rate_limits`, legacy 3-argument `check_rate_limit`, and legacy 3-argument `create_order` are removed.

### Transformed

* Product, brand, category, cart, wishlist, offer-product, review, image, variant, and order-item normal relationships use UUID FKs.
* Brand/category slugs remain unique URL/display/filter keys only; `products.brand_id` and `products.category_id` are authoritative relationships.
* Product metadata migration is exact: ordered highlights aggregate to `array_agg(body ORDER BY position)`; includes aggregate identically; specs aggregate to ordered JSONB objects `{"label": label, "value": value, "position": position}`. Badges and related rows are discarded only after business approval because they have no target representation.
* A legacy variant becomes a complete child product row. Its parent product becomes a family grouping record with `is_family_parent = true` and `stock IS NULL`; the old variant-specific display data is copied into the child product. Child products have `is_family_parent = false` and non-null stock. `product_variants` becomes `parent_product_id`, `product_id`, `variation_attributes`, and `position`.
* `orders.id` moves from text to UUID; legacy text IDs become `order_number` (where unique), with a generated fallback only after collision review. `order_items.order_id`, `order_events.order_id`, and status functions use UUID.
* Old timeline completed states migrate one-for-one into immutable events only where a historical row is actually done. Future empty placeholders are not migrated and are never generated.
* `worker_rate_limits.key` must be parsed by a reviewed service-specific procedure; opaque keys cannot safely be transformed automatically. Existing rows were zero at inspection. Target writers must emit action/dimension/hash explicitly.

## 7. Permissions and RLS changes

All target public business tables enable RLS. Catalog reads (`categories`, `brands`, active products, images, variant relationships, published offers and offer products) are public `SELECT` only. Reviews are public `SELECT`; inserts/updates are authenticated and constrained to `auth.uid()` plus delivered-order eligibility; deletes are not browser-granted.

Profiles, addresses, carts, wishlists, orders, order items, and order events have owner-only policies. Browser users receive no direct write access to orders, order items, order events, catalog data, offers, internal security tables, or transaction functions. `signup_authorizations` and `worker_rate_limits` have RLS with no browser policies. Browser `EXECUTE` is revoked from `create_order`, `change_order_status`, `cancel_order`, `return_order`, and `check_rate_limit`; service role alone receives those executes. The auth-hook consume functions are only executable by `supabase_auth_admin` as required by Supabase Auth.

No policy, grant, table, type, function, trigger, index, relationship, or seed behavior for `circulation_entries` or `circulation_versions` is modified by the canonical business hierarchy.

## 8. Exact constraints and indexes

Target integrity constraints include: UUID primary keys; unique SKU and slug; uppercase alphanumeric SKU length at most 10; `stock >= 0`; `is_family_parent` records have `stock IS NULL` and cannot be preorder; every non-family product has non-null stock; non-self variant relationship with a family-parent/non-family-child relationship; unique parent/child variant relation; non-negative price; compare-at greater than price when present; cart quantity `1..99`; user/product cart, wishlist, and review uniqueness; review rating `1..5`; valid address default uniqueness; order idempotency unique per user; non-negative order totals; order-item quantity/price totals; and foreign keys on all normal relationships.

Target indexes include product SKU/slug/active category and brand access; `product_images(product_id, position)`; parent and child product-variant access; offer-product product/offer access; cart and wishlist user/product; review user/product; addresses user/default; orders user/date and user/idempotency; order items order/product; order events order/time; signup authorization token/email/expiry; and rate-limit `(action, dimension, subject_hash, created_at desc)`. Obsolete slug, availability, metadata, badge, related-product, timeline, and variant-stock indexes are removed with their objects.

## 9. Functions replaced

| Current function | Target |
|---|---|
| `check_rate_limit(text,int,int)` | `check_rate_limit(text,text,text,int,int)`, using structured `worker_rate_limits`; service-role only. |
| `create_order(uuid,uuid,text)` | `create_order(uuid,uuid,text,int)`, UUID orders/items, locked inventory, price check, idempotency payload consistency, initial event, and cart clearing in one transaction. |
| `consume_signup_authorization` / `hook_validate_signup_authorization` | Retained with the same atomic hash-only native signup authorization architecture. |
| `handle_new_auth_user` | Retained as Auth-to-profile trigger function. |
| `set_updated_at` | One shared implementation, retained. |
| no target equivalent | legacy timeline creation and old slug/variant helper behavior are removed. |

The idempotency function must compare an existing request’s address and expected total before returning it. The canonical target stores `idempotency_request_hash`; reuse with a materially different input raises `IDEMPOTENCY_KEY_REUSED` rather than silently returning the prior order.

## 10. Required canonical order transaction and status behavior

`create_order` is service-role-only and atomically validates idempotency, address ownership, cart, active/sellable products, quantity, stock and authoritative price; locks product rows; computes discount/shipping; decrements non-preorder stock; creates order/order items/initial `order_created` event; and clears the cart. Any error rolls back the entire operation. COD has no reservation table or inventory microservice.

Allowed status transitions are exactly: `processing→confirmed`, `confirmed→shipped`, `shipped→out-for-delivery`, `out-for-delivery→delivered`, `processing→cancelled`, `confirmed→cancelled`, and `delivered→returned`. `change_order_status` validates and appends a single immutable event atomically. `cancel_order` locks referenced products, restores non-preorder stock once through the legal transition, and appends `cancelled`; `return_order` appends `returned` and never restores stock.

## 11. Ranking objects explicitly untouched

`circulation_entries` and `circulation_versions`, their circulation enum types, constraints, indexes, policies, grants, producer, consumer, and seed data are out of scope. The canonical hierarchy does not create, alter, drop, seed, truncate, rename, or change them. The old destructive root scripts are removed precisely because they would alter/reseed those protected ranking objects.

## 12. Migration/rebuild strategy

This canonical hierarchy is a clean-build definition, not a destructive migration to apply to the active project. It intentionally keeps `supabase/migrations/` empty for future, approved delta migrations only. A live deployment must not delete or rewrite already-applied migration history.

For a non-disposable database, perform the following separately in a reviewed migration branch/clone:

1. Take and verify a database backup/PITR point. Capture table counts, checksums for product metadata, order/item/event counts, foreign-key violations, function signatures, RLS policies, and grants.
2. Freeze catalog/order writes or use a short controlled cutover window. Do not touch circulation objects.
3. Add UUID IDs/FKs alongside old slug columns; backfill by joining unique slugs. Add temporary validation queries. Do not drop old keys yet.
4. Add product embedded metadata and aggregate ordered source rows. Verify product-by-product counts/order/JSON before removing source metadata tables.
5. Materialize complete child products, map parent/child links, migrate variant stock into child `products.stock`, validate family stock invariants, and remove old variant fields only after consumers deploy.
6. Add UUID order IDs/order numbers and UUID item/event FKs while retaining all historical snapshots. Convert real timeline events; discard only future empty timeline placeholders after the UI no longer reads the table.
7. Deploy Worker and frontend changes that use `brand_id/category_id`, UUID orders, `order_events`, and the canonical function signatures. Deploy the ProcessingServer resolution of slug events to the existing protected circulation entry identity separately.
8. Replace trusted functions, RLS, and grants only after the Worker reaches the compatible release. Revoke legacy browser execution before exposing the new schema.
9. Verify data and consumers, then remove old columns, tables, functions, types, policies, indexes, and compatibility code in a final approved migration. Retain only actual database migration history required by the deployment platform; do not retain old repository scripts “for reference.”

For a confirmed disposable database, first create/confirm a snapshot or confirm explicit permission to discard it, then provision a clean database and apply `schema/00_extensions.sql` through `schema/08_grants.sql` in lexical order, followed by `schema/09_seed.sql` only when test data is needed. Protected ranking objects must already exist and remain outside this process.

## 13. Final repository layout

```text
supabase/
  schema/
    00_extensions.sql
    01_types.sql
    02_tables.sql
    03_constraints.sql
    04_indexes.sql
    05_functions.sql
    06_triggers.sql
    07_rls.sql
    08_grants.sql
    09_seed.sql
  migrations/                 # future approved delta migrations only
```

## 14. Compatibility status

The current Worker’s order and rate-limit RPC signatures match the canonical target. Current cart, wishlist, review, product UUID, embedded metadata, and child-variant consumers match it. The current catalog code still expects `brand_slug` and `category_slug`, and the orders UI still expects `order_timeline`; those are documented deployment dependencies, not compatibility tables retained in the target. The ProcessingServer circulation write is also incompatible with the current storefront UUID circulation consumer; it must be corrected outside this task while leaving protected ranking objects unchanged.

## 15. Verification plan

Before database application: parse all SQL with PostgreSQL/Supabase tooling; verify object creation order; scan for duplicate DDL; check FK/type/function/trigger/policy/grant references; scan for forbidden obsolete product metadata/badge/related/timeline/slug-FK/variant-stock definitions; scan Worker RPC signatures; and check no canonical SQL references circulation objects.

On a confirmed disposable database only: apply files in lexical order; inspect `pg_constraint`, `pg_indexes`, `pg_proc`, `pg_trigger`, `pg_policies`, `information_schema.role_routine_grants`, and table RLS states; run transaction tests for a successful order, duplicate same request, conflicting idempotency reuse, out-of-stock rollback, each allowed/illegal status transition, cancellation one-time restock, delivered return no-restock, review eligibility, signup authorization single use, and service-role-only rate-limit/order calls. Seed validation must confirm simple/variant/stock-zero/low-stock/preorder scenarios and must confirm no circulation mutations.

For a data-preserving migration: run the count/content and orphan checks before and after every transformation in section 12, verify historical order snapshots byte-for-byte where applicable, and deploy consumers before removing their legacy dependencies.

## Deployment update — 2026-08-22

After the audit, the operator explicitly authorized a full destructive wipe of the active project, including the previously protected ranking tables. Supabase migration `wipe_public_schema_for_canonical_rebuild` dropped and recreated the entire `public` schema, so `circulation_entries` and `circulation_versions` are no longer present. The canonical migrations `canonical_00_extensions` through `canonical_09_seed`, followed by `canonical_hardening`, were then applied to `onyzjnitnekjhdexecdm`.

Post-deployment validation found 17 public canonical tables with RLS enabled, 2 brands, 2 categories, 7 products, 1 valid family parent, 2 valid variant links, 3 product images, 1 offer, and 2 offer-product links. Legacy/ranking tables (`circulation_entries`, `circulation_versions`, `order_timeline`, `product_badges`, and `product_related`) are absent. The intentional no-browser-policy state for `signup_authorizations` and `worker_rate_limits` remains; `can_review_product` remains an authenticated, intentionally exposed `SECURITY DEFINER` eligibility RPC. Leaked-password protection remains an Auth dashboard setting and was not changed by database DDL.
