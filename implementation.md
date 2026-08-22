# FUSION GADGETS — AUTHORITATIVE IMPLEMENTATION PLAN

This document is the frozen architecture and implementation reference for the next major refactor.
It is the source of truth. No implementation task may deviate from the decisions, flows, constraints,
and hard rules defined here.

---

## ABSOLUTE NO-DRIFT RULES

The following rules are in force for every phase of this refactor. Violating any of them is not
permitted regardless of convenience, code brevity, or AI reasoning.

1. Do not summarize this plan.
2. Do not replace detailed rules with references such as "as discussed above".
3. Do not omit important flow steps.
4. Do not merge phases because they appear related.
5. Do not invent additional phases unless something is technically required to safely implement the exact plan.
6. Do not remove a requirement because it appears unnecessary.
7. Do not simplify security-critical logic.
8. Do not redesign the architecture.
9. Do not introduce admin implementation.
10. Do not touch the ranking system.
11. Do not touch `circulation_entries` or `circulation_versions`.
12. Do not create compatibility architecture unless a migration technically requires a temporary migration step.
13. Do not create duplicate systems.
14. Do not create generic "utils" or "helpers" dumping grounds.
15. Do not put business logic in the wrong layer merely to reduce file count.
16. Do not move transaction authority into the Worker.
17. Do not move sensitive request authority into the frontend.
18. Do not use SKU, slug, or email as relational identity.
19. Do not use browser/device fingerprinting for rate limiting.
20. Do not use `admin.createUser()`.
21. Do not remove the existing Before User Created Hook.
22. Do not replace Supabase native OTP verification.
23. Do not replace the current Worker-owned registration security architecture.
24. Do not create an AI recommendation system.
25. Do not create a vector database.
26. Do not create a stock reservation system for COD.
27. Do not begin implementation after writing these files.

---

## AUTHORITATIVE ARCHITECTURE

The final system has four primary authorities.

### NEXT.JS
UI, SSR, public reads, authenticated user UX.

### WORKER
Sensitive request authority, abuse protection, input validation, authentication verification for
Worker-owned operations, request orchestration, error normalization.

### SUPABASE
Authentication, RLS, authoritative database state, transactions, inventory integrity, order
integrity, database-side algorithms.

### TrackingServer / ProcessingServer
Separate future processing/tracking concerns. Do not mix their implementation into this refactor
unless the exact plan explicitly requires their existing data to remain compatible.

**Core principle:**

> "The Worker controls who may perform a sensitive operation; the database controls whether that
> operation is valid and atomic."

---

## SCOPE

### In Scope

- Product/catalog model
- Product variation grouping
- Product identity migration
- Product metadata consolidation
- Algorithmic related products
- Inventory
- Cart integrity
- Checkout/order creation
- Order status lifecycle
- Tracking events
- Reviews integration
- Worker structure
- Worker security
- Rate limiting
- Global error contract
- Frontend migration
- Canonical SQL cleanup
- Seed data

### Explicitly Out of Scope

- Admin UI
- Admin backend
- Admin workflows
- Admin APIs
- Ranking-system implementation
- `circulation_entries`
- `circulation_versions`

`circulation_entries` and `circulation_versions` are ranking-system tables and must remain
untouched in this phase.

---

## IDENTITY MODEL

This is a hard rule. All relational references must use UUIDs.

### USER
- `auth.users.id` / `profiles.id`
- UUID
- Referenced as `user_id`

### PRODUCT
- `products.id`
- UUID
- Referenced as `product_id`

### VARIATION FAMILY
- `product_variants.parent_product_id`
- `product_variants.product_id`

### SKU
- `products.sku`
- Unique product identifier
- DB-generated
- Not a foreign key

### SLUG
- `products.slug`
- URL/SEO identifier
- Not a foreign key

### EMAIL
- Authentication/contact attribute
- Not a permanent relational identity

### IP / email hash / temporary identifiers
Only allowed for:
- Anonymous abuse prevention
- Rate limiting
- Pre-user authorization/correlation

All normal relational references must use UUIDs.

**Examples of correct UUID foreign keys:**

```
cart_items.product_id
wishlist_items.product_id
product_images.product_id
product_reviews.product_id
offer_products.product_id
order_items.product_id

cart_items.user_id
wishlist_items.user_id
addresses.user_id
orders.user_id
product_reviews.user_id
```

**Do not use:**
- SKU as foreign key
- Slug as foreign key
- Email as ownership key
- IP as ownership key

---

## PRODUCT MODEL

Keep a single `products` table for actual products. Every variation is also a complete product.

The model is:

```
Parent product
  ├── Product A
  ├── Product B
  └── Product C
```

Each child is a complete `products` row.

The existing `product_variants` table remains only as the relationship/grouping layer connecting
product records into one variation family. It must not become the storage location for the variant
product's core data.

The relationship concept:

```
parent_product_id
product_id
variation attributes
ordering if required
```

### No Runtime Inheritance

There is NO runtime inheritance model.

Do not implement:
```
variant.field ?? parent.field
```

Do not copy parent information into variants automatically.

A variant can have its own:
- name
- description
- price
- compare_at_price
- stock
- images
- highlights
- includes
- specs
- SKU
- slug
- offers
- other product-specific data

The parent and child product records are independently stored complete products.

The admin workflow that creates these records is NOT part of this phase.

---

## PRODUCT METADATA

The following product metadata tables are to be removed after a safe data migration and consumer audit:

- `product_highlights`
- `product_includes`
- `product_specs`
- `product_badges`
- `product_related`

### Highlights
Move ordered highlight rows into `products.highlights` as an ordered array.

### Includes
Move ordered include rows into `products.includes` as an ordered array.

### Specs
Move `product_specs` rows into `products.specs` JSONB.

Preserve the current ordering. Prefer an ordered JSON structure such as an array of label/value
objects when preserving current display order.

### Badges
Remove `product_badges` entirely.

Do not replace it with a `badges[]` column.

Do not create another badge abstraction.

Do not store the following as badges:
- Sale
- Pre-order
- Out-of-stock
- Low-stock
- New

These states must come from authoritative product/offer state:

| State | Source |
|---|---|
| Sale | Active offer state |
| Pre-order | `is_preorder` / product state |
| Out of stock | `stock = 0` |
| Low stock | Derived from stock threshold |
| New | Lifecycle / `created_at` if the UI needs it |

### Related Products
Remove `product_related`.

Do not replace it with another persistent relationship table.

---

## PRODUCT INVENTORY MODEL

The inventory model is:

> Every sellable product has its own `products.stock` value.

There is no separate inventory authority for variants.

A parent product that only groups variants is not itself the sellable inventory unit.

**Example:**

```
Parent product: Halo One Wireless
  stock = NULL / non-sellable as a family product

Child product: Black
  stock = 8

Child product: Silver
  stock = 3

Child product: Blue
  stock = 0
```

For a simple product with no variants:
- `products.stock` = authoritative inventory

For a variant product:
- `products.stock` = authoritative inventory for that actual child product

### Remove Competing Inventory Representations

Remove:
- `product_variants.in_stock`
- Independently editable `products.availability`

Inventory must have a single numeric authority.

### Database Integrity

Add database constraint:
```sql
stock >= 0
```

Do not create a separate inventory table.

Do not create an inventory microservice.

Do not create a stock reservation subsystem for COD.

---

## AVAILABILITY MODEL

Availability should be derived from authoritative product state.

Use:
- `is_active`
- `is_preorder`
- `stock`

Conceptual derivation:

```
is_active = false
  → not available according to catalog rules

is_preorder = true
  → preorder

is_preorder = false AND stock = 0
  → out of stock

is_preorder = false AND stock > 0 AND below low-stock threshold
  → low stock

otherwise
  → in stock
```

Do not maintain a second freely editable availability enum that can contradict stock.

---

## CART QUANTITY RULES

`cart_items.quantity` must have a database CHECK preventing non-positive values.

At minimum:
```sql
quantity >= 1
```

Also enforce a practical maximum.

The exact business maximum must be explicitly decided during implementation and applied consistently.

Both layers must validate:
1. Database constraint
2. Order transaction validation

These are not considered redundant because they protect different boundaries.

---

## CHECKOUT PREVIEW

The frontend must not be the authoritative calculator.

A checkout summary must resolve authoritative:
- Cart items
- Actual product data
- Actual selected variant product
- Current price
- Discounts
- Shipping
- Current inventory availability
- Authoritative total

The frontend displays the returned summary.

The frontend does NOT decide:
- Price
- Subtotal
- Discount
- Shipping
- Total
- Stock

The Worker owns request authority and abuse protection. The database owns authoritative
catalog/business calculations.

---

## FINAL ORDER REQUEST

The final create-order request should contain only the minimum required mutable input:

```
address_id
idempotency_key
```

The user identity must be derived from the verified JWT.

The browser must never submit authoritative:
- `user_id`
- price
- subtotal
- shipping
- total
- stock
- product name
- relationship slug
- relationship SKU

---

## ORDER TRANSACTION

Order creation remains a database transaction.

Do NOT move the entire order transaction into the Worker.

Do NOT recreate the database transaction as multiple Worker-side queries.

The required transaction is:

```
BEGIN
  → validate idempotency
  → validate address ownership
  → load authenticated user's cart
  → resolve each actual product
  → resolve variation/family relationships when needed
  → lock every relevant inventory product row
  → validate quantity
  → validate purchasability
  → calculate authoritative current prices
  → calculate shipping and discounts
  → decrement stock
  → create order
  → create order_items
  → create initial tracking event
  → clear cart
COMMIT
```

Everything succeeds together or everything rolls back.

If stock cannot be safely decremented, the order must not be created.

---

## ORDER IDENTITY

Use:

- `orders.id` — UUID — internal relational identity
- `orders.order_number` — unique human-facing order identifier

Do not use `order_number` as a foreign key.

Replace the current small random order-number scheme with a production-safe unique scheme.

---

## IDEMPOTENCY

Keep order idempotency.

The key must be authoritative and user-scoped.

Use the authenticated user identity as part of the uniqueness boundary.

If the same user retries the same request:
→ return the existing order safely.

If the same idempotency key is reused against materially different order data:
→ reject it.

Do not silently bind one idempotency key to a different order state.

---

## PRICE CONSISTENCY

The server/database is always authoritative.

Checkout preview shows current data.

Final order creation recalculates everything.

If the authoritative total differs from what the user was previously shown:
- Return a specific price-change application error and updated authoritative information.
- The user must explicitly confirm the new amount.

Do NOT implement:
- Price locking
- Price reservations
- Long-lived checkout locks

---

## ORDER STATUS LIFECYCLE

The final lifecycle is:

```
processing
  ↓
confirmed
  ↓
shipped
  ↓
out-for-delivery
  ↓
delivered
```

Cancellation:
```
processing → cancelled
confirmed  → cancelled
```

Return:
```
delivered → returned
```

Do not allow arbitrary status jumps.

Examples that must fail:
- `processing → delivered`
- `delivered → processing`
- `cancelled → shipped`
- `returned → delivered`

The database/backend must enforce legal transitions.

The customer can read state but cannot mutate order status.

The future Admin system will eventually perform authorized status transitions, but Admin is not
implemented now.

---

## TRACKING MODEL

Do not pre-create empty future timeline rows.

Tracking must be immutable event history.

Use a final tracking/event table:

```
order_events
  - id
  - order_id
  - event_type
  - created_at
  - optional metadata
```

Current order state: `orders.status`

Historical tracking: `order_events`

When status changes:
```
UPDATE orders SET status = new_state
AND
INSERT order_events(...)
```

Both operations must happen in the same transaction.

Only actual events should exist.

New order → `order_placed` / processing event

Later:
- `order_confirmed` event
- `shipped` event
- `out_for_delivery` event
- `delivered` event

---

## TRACKING VS ORDER STATUS

Keep primary order state smaller than the customer-facing tracking milestones.

**Order status values:**
- processing
- confirmed
- shipped
- out-for-delivery
- delivered
- cancelled
- returned

**Tracking event types (may include):**
- order_placed
- order_confirmed
- packed
- shipped
- out_for_delivery
- delivered
- cancelled
- returned

`packed` may be a tracking event without becoming a primary order status value.

Do not add unnecessary status values just for UI text.

---

## INVENTORY SIDE EFFECTS

**Order creation:**
```
stock -= purchased quantity
```

**Cancellation before shipment:**
```
stock += purchased quantity
```

The stock restoration must be part of the valid cancellation transition and must be idempotent.

**Shipped:** no stock change

**Out for delivery:** no stock change

**Delivered:** no stock change

**Returned:**
Do NOT automatically add stock back. Returned physical goods may need inspection before becoming
sellable again. That future restock flow belongs to the future inventory/admin system.

---

## REVIEW INTEGRATION

Reviews use:
- `product_reviews.user_id`
- `product_reviews.product_id`

Review eligibility requires:
```
order.user_id = current user
AND order status = delivered
AND order_items.product_id = reviewed product
```

Because every variation is its own product, reviews remain bound to the exact purchased product.

A product-family page may aggregate reviews across its variation products if required by the
existing UX, but the stored review must always retain the actual `product_id`.

---

## RELATED PRODUCT ALGORITHM

Related Products must be algorithm-driven.

Operate on product families, not individual variants.

Never show multiple variations from the same family as multiple distinct related products.

**Exclude:**
- Current product family
- Inactive products
- Unavailable products according to catalog rules

**Score using a simple deterministic model based on available product metadata:**

Signals:
- Same subcategory
- Same category
- Same brand
- Shared meaningful specs
- Price similarity

Apply a simple diversity pass.

Return top 4–8 candidates.

Use deterministic secondary ordering.

**Do NOT use:**
- AI
- Embeddings
- Vector database
- Recommendation service
- Background recommendation workers
- `product_related` table

The database may host the related-product query/function because it already owns the product data.

---

## WORKER STRUCTURE

The Worker must be reorganized into responsibility-based boundaries.

**Target structure:**

```
src/
├── config/
│   └── env.ts
│
├── http/
│   ├── response.ts
│   └── errors.ts
│
├── infrastructure/
│   ├── supabase.ts
│   └── turnstile.ts
│
├── security/
│   ├── auth.ts
│   └── rate-limit.ts
│
├── registration/
│   ├── route.ts
│   ├── service.ts
│   ├── authorization.ts
│   └── validation.ts
│
├── account/
│   ├── route.ts
│   ├── service.ts
│   └── validation.ts
│
├── orders/
│   ├── route.ts
│   ├── service.ts
│   └── validation.ts
│
└── index.ts
```

Do not blindly create every file if an existing responsibility can remain cleanly grouped.

The structure above is the target responsibility model, not permission to create meaningless wrappers.

Remove dead pass-through abstractions.

Remove the unused `dev.ts` after confirming it is genuinely unused.

Do not create:
- Generic utils
- Generic helpers
- Feature dumping grounds
- Duplicate auth providers
- Duplicate error systems
- Duplicate Worker entry points

---

## GLOBAL ERROR SYSTEM

The existing auth-specific error system becomes a global application error system.

Contract:

```json
{
  "code": "...",
  "message": "...",
  "status": 400
}
```

The global system belongs under the global HTTP/application error responsibility, not authentication.

`message` is the only user-facing field.

The frontend must display only:
```ts
toast.error(error.message)
```

Never display:
- `code`
- HTTP status
- Supabase message
- SQL message
- Stack trace
- Internal implementation details

**Expected error groups:**

- `AUTH_*`
- `REGISTRATION_*`
- `OTP_*`
- `PASSWORD_RESET_*`
- `ORDER_*`
- `INVENTORY_*`
- `VALIDATION_*`
- `RATE_LIMIT_*`
- `INTERNAL_*`

Do not create dozens of micro-codes unnecessarily.

Order errors must use this same centralized contract.

---

## RATE LIMITING MODEL

The existing rate-limit table is too unstructured.

Do not use arbitrary concatenated keys such as:
```
register:ip
register:email
orders:user_id
```

Use structured concepts.

**Target fields:**

```
action
dimension
subject_hash
created_at
```

**Dimensions may be:**
- `ip`
- `email`
- `user`

Use hashes/HMACs where practical rather than storing raw email/IP in rate-limit state.

There must be no device fingerprinting subsystem.

Do not collect:
- Screen size
- GPU
- Browser fingerprint
- Canvas fingerprint
- Timezone fingerprint
- Device model fingerprint
- Font fingerprint
- Similar tracking data

The required protection is action + dimension based.

---

## RATE LIMIT POLICIES

**Registration:**
- IP: 5 / 15 minutes
- Email: 3 / 15 minutes

**OTP resend:**
- Email: 3 / 24 hours
- IP: short burst protection

**Password reset:**
- Email: 1 / 24 hours
- IP: 3 / 24 hours
- Successful reset: 24-hour cooldown

**Order creation:**
- User: 5 / 15 minutes
- IP: short burst protection

The exact IP burst values must be defined during implementation and applied consistently. Do not
invent an overly aggressive limit that harms normal shared-network users.

The password reset limit is intentionally aggressive because users should not normally need
frequent resets. Users who genuinely need another reset during the cooldown can use support.

---

## RATE LIMITER SECURITY

`check_rate_limit` must not be callable from browser roles.

The browser must not be able to directly execute the rate-limit primitive.

`create_order` must not be directly callable by anon/authenticated browser roles.

Only the trusted Worker/service-role boundary should execute the privileged order operation.

The database/RPC boundary must not rely on the frontend staying honest.

---

## AUTHENTICATION PRESERVATION

Do not redesign the current working authentication architecture.

**Preserve this exact flow:**

```
Browser
→ Managed Turnstile
→ Worker registration
→ IP + email rate limits
→ one-time signup authorization
→ hash-only authorization persistence
→ normal Supabase signup
→ Before User Created Hook
→ atomic authorization validation/consumption
→ unconfirmed Supabase user
→ native Supabase OTP
```

OTP verification remains direct through the correct Supabase `verifyOtp` client flow.

Sign-in remains normal Supabase password sign-in.

Password reset remains Worker-protected and enumeration-safe.

Do not use `admin.createUser()`.

Do not move sign-in into Worker without a concrete requirement.

Do not move OTP verification into Worker.

Do not remove the Before User Created Hook.

Do not remove `signup_authorizations`.

Do not weaken atomic authorization consumption.

---

## INFRASTRUCTURE SECURITY

Remove hardcoded production/test service credentials from `env.ts`.

Required secrets must come from runtime environment configuration.

Do not leave service-role or Turnstile secrets as source-code fallback values.

Add a bounded timeout to shared Supabase REST calls.

Worker requests must not hang indefinitely on upstream Supabase operations.

Do not add arbitrary retry loops.

---

## RLS AND DATABASE PERMISSIONS

Explicitly review every affected table and classify its access model.

**User-owned data:** RLS remains important.

**Internal security tables:** must not be browser-accessible.

**Internal rate-limit primitive:** must not be browser-executable.

**Privileged order/inventory mutation:** must be reachable only through the trusted
Worker/database boundary.

Do not broadly disable RLS to simplify the implementation.

Do not rely solely on service-role if business ownership validation is needed inside the trusted
transaction.

---

## FRONTEND MIGRATION

Update all affected frontend code to the final schema.

Product reads should use:
- `products`
- Embedded highlights
- Embedded includes
- Embedded specs
- `product_images`
- Variation relationships
- `product_reviews`
- `offers` where applicable

Remove reads from deleted tables:
- `product_highlights`
- `product_includes`
- `product_specs`
- `product_badges`
- `product_related`

All relational references use UUID `product_id`.

Variant selection resolves to an actual product UUID.

The cart stores the selected product UUID.

The order stores the selected product UUID.

The review stores the selected product UUID.

Do not introduce slug-based compatibility logic.

---

## PRODUCT PAGE

The product page should:

- Load the actual product
- Resolve its variation family
- Resolve actual child product records
- Allow selecting a child product
- Display the selected product's own price
- Display its own stock
- Display its own images
- Display its own SKU
- Display its own product-specific data
- Display related products using the algorithm
- Display reviews according to the existing review architecture

Do not perform runtime parent-field inheritance.

---

## CHECKOUT / FRONTEND ORDER FLOW

```
Checkout
  → resolve authenticated user
  → load addresses
  → select address
  → request/consume authoritative checkout summary
  → user confirms COD
  → send minimal create-order request
  → Worker authenticates
  → Worker rate-limits
  → Worker validates
  → database transaction executes
  → return order_id + order_number + authoritative total
  → frontend updates centralized cart state
  → navigate to existing order success flow
```

Never trust frontend totals or inventory assumptions.

---

## SEED DATA

Seed data must be rewritten for the new schema.

**Include:**
- Simple products
- Parent/variation families
- Complete independent variant product records
- Out-of-stock products
- Low-stock products
- Preorder products
- Active offers
- Reviews
- Delivered orders
- Orders in different lifecycle states
- Realistic tracking events
- Product families with strong related-product candidates
- Product families with fallback related-product candidates

**Do not seed:**
- Deleted metadata tables
- `product_related`
- Badges
- Circulation ranking tables as part of this phase

---

## SQL CLEANUP

The goal is a canonical, stale-free database model.

**Before deleting any existing object:**

1. Find all application references.
2. Find all RPC references.
3. Find all trigger references.
4. Find all RLS references.
5. Find all foreign-key references.
6. Find seed dependencies.
7. Migrate data where necessary.
8. Verify the replacement.
9. Only then remove the obsolete object.

Do not blindly delete migration history.

Determine whether the live database requires an in-place migration or controlled canonical rebuild.

Do not create duplicate compatibility tables.

Do not keep stale tables "just in case".

Do not delete ranking-system circulation tables.

---

## REQUIRED FLOW DIAGRAMS

### Registration Flow

```
Browser
  ↓
Managed Turnstile
  ↓
Worker /auth/register
  ↓
input validation
  ↓
IP rate limit
  ↓
email rate limit
  ↓
server-side Turnstile validation
  ↓
one-time signup authorization
  ↓
hash-only storage
  ↓
normal Supabase signup
  ↓
Before User Created Hook
  ↓
atomic authorization validation/consumption
  ↓
unconfirmed user created
  ↓
native Supabase OTP
  ↓
frontend verifyOtp
  ↓
AuthProvider
  ↓
onboarding
```

### Order Creation Flow

```
Browser
  ↓
authenticated checkout
  ↓
Worker /orders
  ↓
JWT verification
  ↓
user rate limit
  ↓
IP rate limit
  ↓
request validation
  ↓
authoritative order transaction
  ├── idempotency
  ├── address ownership
  ├── cart validation
  ├── product resolution
  ├── inventory row locking
  ├── stock validation
  ├── authoritative pricing
  ├── stock decrement
  ├── order creation
  ├── order item creation
  ├── order event creation
  └── cart clearing
  ↓
COMMIT
  ↓
Worker response
  ↓
frontend order success
```

### Order Status Transition Flow

```
authorized transition
  ↓
validate current_state → new_state
  ↓
perform required side effects
  ↓
update orders.status
  ↓
insert order_events
  ↓
COMMIT
```

### Cancellation Flow

```
authorized cancellation
  ↓
validate current status is cancellable
  ↓
restore inventory exactly once
  ↓
set status = cancelled
  ↓
insert cancellation event
  ↓
COMMIT
```

### Related Products Flow

```
Product family
  ↓
active candidate products
  ↓
exclude same family
  ↓
category/subcategory/brand/spec/price scoring
  ↓
diversity pass
  ↓
deterministic sort
  ↓
top 4–8
```

---

## IMPLEMENTATION PHASES

The phases below are mandatory and must remain separate. Do not merge them.

---

### PHASE 1 — FREEZE AND VERIFY TARGET SCHEMA

Inspect and explicitly confirm:

- Product identity model
- SKU role
- Slug role
- User identity model
- Variation relationship
- Inventory model
- Availability model
- Order lifecycle
- Tracking events
- Review relationship
- Rate-limit structure
- Global error contract
- RLS boundaries
- Privileged RPC boundaries

Do not implement code yet unless this phase itself requires a harmless
documentation/schema verification artifact.

Output a confirmed implementation basis.

---

### PHASE 2 — DATABASE SECURITY HARDENING

Fix the proven security/reliability issues first:

- Restrict `create_order` execution to trusted Worker/service-role boundary only
- Restrict `check_rate_limit` execution — must not be callable from browser roles
- Remove hardcoded secrets from `env.ts`
- Add bounded timeout to shared Supabase REST calls
- Verify affected RLS policies
- Verify service-role boundaries

Do not yet perform the full schema consolidation.

---

### PHASE 3 — PRODUCT SCHEMA MIGRATION

Implement:

- UUID product identity
- SKU
- Slug
- Embedded highlights (`products.highlights` ordered array)
- Embedded includes (`products.includes` ordered array)
- Specs JSONB (`products.specs` ordered array of label/value objects)
- Correct variation relationship using UUIDs
- UUID foreign keys across all dependent tables

Migrate data.

Remove after verified:
- `product_highlights`
- `product_includes`
- `product_specs`
- `product_badges`
- `product_related`

Keep:
- `brands`
- `categories`
- `product_images`
- `product_reviews`
- `product_variants` relationship table
- `offers`
- `offer_products`

Do not touch `circulation_entries` or `circulation_versions`.

---

### PHASE 4 — VARIATION MODEL MIGRATION

Ensure:

- Every variation is a complete `products` row
- `product_variants` only groups product records
- No runtime inheritance
- Variation relationship uses UUIDs
- Cart, order, and reviews use actual product UUIDs

No admin implementation.

---

### PHASE 5 — INVENTORY REWRITE

Implement:

- `products.stock` as authoritative inventory
- Database constraint: `stock >= 0`
- Parent family product not treated as sellable inventory when variants exist
- Remove `product_variants.in_stock` old boolean/enum inventory authority
- Remove independently editable `products.availability` enum that contradicts stock
- Derived availability based on `is_active`, `is_preorder`, `stock`
- Correct preorder state

Do not create a second inventory subsystem.

---

### PHASE 6 — CART INTEGRITY

Implement:

- Positive quantity DB constraint (`quantity >= 1`)
- Practical maximum quantity constraint (exact value to be decided during implementation and
  applied consistently)
- Application-layer validation mirroring the DB constraints
- `product_id`-based cart relationships (UUID)
- Variant/family semantics using actual product UUIDs

---

### PHASE 7 — CHECKOUT AND ORDER REWRITE

Implement:

- Authoritative checkout summary endpoint
- Minimal final create-order payload (`address_id`, `idempotency_key`)
- User identity derived from verified JWT — never from request body
- Idempotency with user-scoped uniqueness boundary
- Atomic inventory row locking
- Final stock check inside transaction
- Final authoritative price calculation inside transaction
- Stock decrement inside transaction
- Order creation inside transaction
- Order item creation inside transaction
- Tracking event creation (initial `order_placed`) inside transaction
- Cart clearing inside transaction
- Atomic commit/rollback — if stock cannot be safely decremented, order must not be created
- Price-change detection: if authoritative total differs from user-shown amount, return specific
  price-change error with updated totals; user must explicitly confirm

---

### PHASE 8 — ORDER LIFECYCLE AND TRACKING

Implement:

- Controlled legal status transitions (enforce legal transition matrix; reject illegal jumps)
- Immutable `order_events` append-only event history
- Status change and event insertion in the same transaction
- Cancellation logic: `processing → cancelled` and `confirmed → cancelled` only
- Cancellation stock restoration that is idempotent and part of the cancellation transition
- `delivered → returned` transition
- No automatic return restocking
- Customer read-only tracking access

---

### PHASE 9 — WORKER STRUCTURE

Reorganize according to the responsibility-based target structure.

Move logic out of the old auth dumping ground.

Remove:
- Dead `dev.ts` (after confirming genuinely unused)
- Fake middleware wrappers
- Duplicate email normalization
- Redundant error mapping
- Other code proven obsolete

Do not modify correct authentication logic merely to make the folder tree smaller.

---

### PHASE 10 — RATE LIMITING

Implement the structured rate-limit table:

```
action
dimension
subject_hash
created_at
```

Apply all exact action policies:
- Registration IP: 5 / 15 minutes
- Registration email: 3 / 15 minutes
- OTP resend email: 3 / 24 hours
- OTP resend IP: short burst protection (exact value decided during implementation)
- Password reset email: 1 / 24 hours
- Password reset IP: 3 / 24 hours
- Successful reset: 24-hour cooldown
- Order creation user: 5 / 15 minutes
- Order creation IP: short burst protection (exact value decided during implementation)

Use hashes/HMACs for email/IP where practical rather than raw values.

Keep anonymous/pre-user protection based on IP and normalized email hash.

Keep authenticated protection based on user UUID.

Do not add fingerprinting.

---

### PHASE 11 — GLOBAL ERROR CONTRACT

Implement the global error contract:

```json
{
  "code": "...",
  "message": "...",
  "status": 400
}
```

Move all expected Worker errors into it.

Order errors must no longer have a separate inline map.

Frontend displays only `message`.

Use the defined error group prefixes: `AUTH_*`, `REGISTRATION_*`, `OTP_*`,
`PASSWORD_RESET_*`, `ORDER_*`, `INVENTORY_*`, `VALIDATION_*`, `RATE_LIMIT_*`, `INTERNAL_*`.

The global system belongs under the global HTTP/application error responsibility, not
authentication.

---

### PHASE 12 — FRONTEND MIGRATION

Migrate:

- Product pages (remove deleted-table reads, use embedded fields)
- Variation selection (resolve to actual product UUID)
- Cart (store actual product UUID)
- Wishlist (store actual product UUID)
- Checkout (consume authoritative summary, send minimal payload)
- Order screens (use new lifecycle states)
- Tracking (display `order_events` history)
- Review flows (write/read using actual `product_id`)
- Related product rendering (consume algorithm results)

Remove all reads from deleted tables:
- `product_highlights`
- `product_includes`
- `product_specs`
- `product_badges`
- `product_related`

Do not introduce slug-based compatibility logic.

---

### PHASE 13 — SEED AND VERIFICATION

Rewrite seed data for the new schema (see Seed Data section above).

Then run complete verification for:

- Schema integrity
- Permissions and RLS
- Inventory correctness
- Concurrency and row locking
- Idempotency
- Quantity integrity
- Pricing accuracy
- Lifecycle transitions (legal and illegal)
- Tracking event consistency
- Review eligibility
- Related product algorithm correctness
- Rate limit enforcement
- Authentication regression

Only after verification is complete, remove final stale objects.

---

*End of implementation.md*
