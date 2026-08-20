````markdown
# Fusion Gadgets — Full Production System Implementation Plan

## 1. Goal

Convert the existing fully designed frontend from a mock/simulated store into a real production system without redesigning, simplifying, replacing, or degrading the existing premium UI.

The current UI already exists. Preserve its visual quality, layout, motion, responsiveness, and premium feel. Replace the mock data layer and simulated actions behind it with real infrastructure.

The final system has four main layers:

```text
NEXT.JS STOREFRONT
        │
        ├── Direct read access to Supabase
        │
        ├── Direct standard user-owned writes through RLS
        │
        └── Sensitive actions through Cloudflare Worker
                    │
                    ▼
                 SUPABASE
        Products / Users / Cart / Wishlist / Orders
                    ▲
                    │
             Tracking output
                    │
          TRACKING PROCESSOR
             Render Free
                    ▲
                    │
                TiDB Cloud
             Raw event storage
                    ▲
                    │
          TRACKING INGEST API
             Render Free
                    ▲
                    │
                 Browser
````

The system must remain simple. Use built-in platform capabilities where they already solve the problem reliably.

---

# 2. Core Architecture

## Storefront

Next.js App Router.

The storefront is primarily static and server-rendered.

Catalog and SEO pages use SSG and ISR.

User-specific pages use static server-rendered shells. Only the interactive or user-data areas become Client Components.

All important visible text must exist in the server-rendered HTML.

Do not turn an entire page into a Client Component because one form, filter, button, or interactive section needs client code.

The browser hydrates the required interactive components after the HTML is rendered.

The frontend communicates directly with Supabase for normal reads and standard RLS-protected user-owned operations.

The frontend communicates directly with the Cloudflare Worker only for sensitive actions that require server-side authority.

The frontend communicates directly with the tracking ingest backend for batched tracking events.

The frontend never communicates with TiDB.

The frontend never communicates with the tracking processor.

---

# 3. Mock System Migration

Remove the existing mock data system completely after the real data layer is ready.

Do not leave a parallel mock system, fallback mock store, fake API layer, or duplicate types behind.

The migration flow is:

```text
EXISTING PREMIUM UI
        │
        ▼
Identify every mock dependency
        │
        ▼
Define real database schema
        │
        ▼
Create seed data for development/testing
        │
        ▼
Implement real data access
        │
        ▼
Connect existing UI to real data
        │
        ▼
Replace simulated actions with real actions
        │
        ▼
Verify every existing UI state
        │
        ▼
Delete mock system
```

Seed data exists only to populate the real database during development and testing.

The UI must consume seeded data through the same real database paths it will use in production.

Do not create special frontend mock adapters.

---

# 4. Frontend Data Rendering

## Static catalog pages

The following type of pages remain server-rendered and static/ISR:

```text
/
 /shop
 /categories
 /categories/[slug]
 /product/[slug]
SEO content pages
```

These pages read the required public data from Supabase during generation.

The generated HTML contains the actual page content and product information.

Product images must use normal image URLs rendered in HTML. Do not use Next.js image optimization for product images.

Product image URLs must remain directly available to crawlers and browsers.

Hero and other non-product images may use the existing image strategy if appropriate, but do not add unnecessary server-side image processing.

Use the existing CDN for images.

Do not redesign image behavior while implementing the backend.

---

# 5. Home Page Data Flow

The home page remains static/ISR.

The tracking processor prepares compact circulation results in Supabase.

The home page consumes the latest published ready data.

```text
TRACKING PROCESSOR
        │
        ▼
SUPABASE READY RESULTS
        │
        ▼
NEXT.JS ISR
        │
        ├── Read current products
        ├── Read offers
        ├── Read categories
        └── Read published circulation results
                │
                ▼
          Render complete HTML
```

Circulation results contain selection and ordering information, not duplicate product records.

Next.js combines:

```text
READY PRODUCT ORDER
+
CURRENT PRODUCT DATA
+
CURRENT OFFER DATA
=
HOME PAGE
```

Validate that a circulated product is still active and eligible before rendering it.

Do not recalculate circulation inside Next.js.

Do not wait for tracking processing.

If a section has no valid data, do not render that section.

If circulation data does not yet exist, use a simple stable catalog fallback so the website still works.

Do not recreate the circulation algorithm as a fallback.

The last successful published result remains usable if processing fails.

---

# 6. Shop and Category Data Flow

The initial shop and category pages are server-rendered and static/ISR.

The default product discovery order comes from published circulation data.

```text
REQUEST STATIC PAGE
        │
        ▼
READ PUBLISHED CANDIDATES
        │
        ▼
READ CURRENT ELIGIBLE PRODUCTS
        │
        ▼
RENDER HTML
```

After hydration, explicit user actions become client-side operations.

Examples:

```text
Filter
Sort
Search
Load more
```

These actions query Supabase directly.

Explicit user intent overrides circulation order.

```text
No explicit filter
→ use prepared circulation

Filter selected
→ query matching products

Search performed
→ query search results

Sort selected
→ use requested ordering
```

Do not make the entire shop page client-rendered because filtering exists.

Do not send filtering requests through the Worker.

Do not send filtering requests through Next.js API routes.

---

# 7. Product Data and Listings

Products are read-only to normal users.

Production listings must not be directly modifiable by browsers.

Product creation and administration belong to the separate future admin system.

The storefront only receives the public product data it is allowed to read.

The public client must never receive a service-role key or other privileged database secret.

Use Supabase's built-in access controls and database capabilities instead of inventing a custom product authorization system.

A product must not become permanently hidden merely because it receives less engagement.

The circulation system controls exposure and rotation, not permanent product suppression.

New products must receive discovery opportunities.

Older products must remain eligible when they are active and relevant.

---

# 8. Offers

Offers are stored as real database data.

The development database must receive seed offers for testing.

The storefront reads active offers and renders them using the existing UI.

Offers are validated again during order creation.

The browser display is never authoritative.

The offer creation flow belongs to the future admin system, not the storefront Worker.

The Worker must not become an admin backend.

Do not implement payment infrastructure while implementing offers.

---

# 9. Authentication

Supabase Auth is the authentication authority.

The Worker is only a thin protection gate for selected abuse-prone entry points.

The Worker does not own authentication state.

The Worker does not own OTP state.

The Worker does not create custom JWTs.

The Worker does not manage token refresh.

The Worker does not wait for users.

The full authentication flow is:

```text
USER SUBMITS REGISTRATION
        │
        ▼
CLOUDFLARE WORKER
        │
        ├── Validate request
        ├── Rate limit
        ├── Lightweight abuse checks
        └── Call Supabase Auth
                │
                ▼
             RETURN

USER MAY TAKE MINUTES
TO COMPLETE VERIFICATION
        │
        ▼
BROWSER ↔ SUPABASE AUTH
        │
        ▼
SESSION ESTABLISHED
        │
        ▼
ONBOARDING
        │
        ▼
SUPABASE + RLS
        │
        ▼
ONBOARDING COMPLETE
```

Each request is independent.

The Worker must return after completing the registration request.

It must never wait for OTP entry.

It must never hold an onboarding session open.

OTP verification uses Supabase Auth.

Session persistence and token refresh use the Supabase SDK.

The application uses authentication state changes to handle sign-in and sign-out.

When an authenticated session becomes invalid, clear private account-scoped client state and redirect to the sign-in flow.

---

# 10. Registration and Onboarding

Phone information required by the business onboarding flow must be completed before onboarding is considered complete.

Address is optional during onboarding.

Address becomes mandatory during checkout.

The onboarding state is persisted in the user's real profile data.

If the user leaves onboarding:

```text
ACCOUNT EXISTS
        │
        ▼
ONBOARDING INCOMPLETE
        │
        ▼
USER RETURNS LATER
        │
        ▼
SIGN IN
        │
        ▼
READ ONBOARDING STATE
        │
        ├── Complete → continue normally
        │
        └── Incomplete → resume onboarding
```

Do not keep onboarding progress in Worker memory.

Do not keep a Worker request open while the user completes onboarding.

Do not autosave every keystroke.

Persist meaningful completed steps or explicit saves only.

---

# 11. Sign-In and Session Management

Sign-in uses Supabase directly.

```text
BROWSER
        │
        ▼
supabase.auth.signInWithPassword()
        │
        ▼
SUPABASE AUTH
        │
        ▼
SESSION
```

The Supabase SDK manages normal session persistence and token refresh.

Do not create:

```text
Custom session backend
Custom refresh endpoint
Worker refresh proxy
Next.js session API
Custom JWT system
```

The browser uses the authenticated Supabase client for normal protected operations.

---

# 12. Password Reset

Password reset requests go through the Worker.

```text
BROWSER
        │
        ▼
WORKER
        │
        ├── Validate
        ├── Rate limit
        ├── Abuse protection
        └── Trigger Supabase reset flow
                │
                ▼
              RETURN
```

Return a generic response.

Never reveal whether an email address exists.

Recovery link handling and password update use Supabase's built-in recovery flow.

Do not create a custom password reset system.

---

# 13. User-Owned Data and RLS

Use Supabase directly for normal user-owned data.

This includes:

```text
Profile
Addresses
Cart
Wishlist
```

RLS must enforce ownership.

```text
USER
        │
        ▼
SUPABASE REQUEST
        │
        ▼
JWT
        │
        ▼
RLS
        │
        ├── Own data → allow
        │
        └── Other user's data → deny
```

Do not route these standard operations through the Worker without a concrete security reason.

---

# 14. Account Isolation and Client Cache

Each authenticated account must remain isolated.

Account-specific browser data must be scoped to the authenticated user.

The flow is:

```text
USER A DATA
        │
        ▼
SIGN OUT
        │
        ▼
CLEAR PRIVATE CACHE
        │
        ▼
USER B SIGNS IN
        │
        ▼
LOAD USER B DATA
```

User A data must never appear under User B.

The same applies to cart, wishlist, profile data, addresses, and cached queries.

Do not use one anonymous global cache for authenticated account data.

---

# 15. Cart

Cart items belong to the authenticated user and sync through Supabase with RLS.

Guest cart data may exist locally before sign-in.

After authentication:

```text
GUEST CART
+
ACCOUNT CART
        │
        ▼
MERGE
        │
        ▼
SUPABASE ACCOUNT CART
        │
        ▼
SUCCESS
        │
        ▼
CLEAR GUEST CART
```

Do not destroy guest cart data before the merge succeeds.

Do not overwrite account cart blindly.

The merge must preserve the intended items according to the real product rules.

After sign-out, private account cart cache must be cleared.

---

# 16. Wishlist

Wishlist follows the same ownership and sync model as the cart.

```text
GUEST WISHLIST
+
ACCOUNT WISHLIST
        │
        ▼
MERGE
        │
        ▼
RLS-PROTECTED ACCOUNT DATA
```

Do not destroy guest data before successful merge.

Do not allow one account to access another account's wishlist.

---

# 17. Checkout

Checkout is COD-only for now.

Do not implement payment gateway code.

Do not build a generic payment abstraction.

The checkout page uses a server-rendered static shell with only required interactive areas hydrated.

The flow is:

```text
CART
        │
        ▼
CHECKOUT
        │
        ├── Load current cart
        ├── Select or create address
        └── Review order
                │
                ▼
ADDRESS VALID?
        │
        ├── NO → cannot place order
        │
        └── YES
                │
                ▼
PLACE COD ORDER
```

Address is mandatory for successful order creation.

Frontend validation improves UX but is not authoritative.

---

# 18. Order Creation

Order creation always goes through the Cloudflare Worker.

The browser does not send a trusted total.

The browser does not send trusted prices.

The browser does not decide whether an offer is valid.

The Worker performs the authoritative checkout operation.

```text
PLACE ORDER
        │
        ▼
WORKER
        │
        ├── Authenticate request
        ├── Validate request
        ├── Rate/abuse checks
        ├── Idempotency check
        ├── Read authoritative cart
        ├── Verify selected address ownership
        ├── Verify products
        ├── Verify availability
        ├── Recalculate prices
        ├── Revalidate offers
        └── Calculate final total
                │
                ▼
        ATOMIC ORDER CREATION
                │
                ├── Create order
                ├── Create order items
                ├── Snapshot prices
                ├── Snapshot product details required for history
                ├── Snapshot delivery address
                └── Update purchased cart state
                        │
                        ▼
                    SUCCESS
```

Clear local cart state only after confirmed success.

Use idempotency to prevent duplicate orders caused by retries, double-clicks, or uncertain network responses.

A repeated successful request with the same checkout idempotency key must return the existing successful result rather than create another order.

The Worker must perform only the required work and complete the request efficiently.

Do not turn order creation into a multi-request workflow.

---

# 19. Order and Address Snapshots

Orders must preserve historical truth.

The delivery address is copied into the order when the order is created.

Later editing or deleting the user's saved address must not change historical orders.

Product and price information required to represent the historical order is also snapshotted.

Do not rebuild old order totals from current product prices.

Do not make old orders depend on the current product record remaining unchanged.

---

# 20. COD Order States

Order state and payment state are separate.

Conceptually:

```text
ORDER
PENDING
CONFIRMED
PROCESSING
SHIPPED
DELIVERED
CANCELLED
```

COD payment state begins as unpaid/pending and is updated when appropriate after delivery handling.

Do not mark a COD order as paid when it is created.

---

# 21. Orders and Privacy

Orders are private user data.

Users may only read their own orders through the storefront.

Order items and order address snapshots must follow the same ownership boundary.

The actual order confirmation route is separate from the account route.

Conceptually:

```text
/checkout
/order/[reference]
```

Order history can exist under the account area.

Do not place the actual order route under `/account` merely because the user is authenticated.

---

# 22. Worker Boundaries

The Cloudflare Worker is not a general backend proxy.

It exists for sensitive short-lived operations.

Primary responsibilities:

```text
Registration protection
Password reset request protection
Order creation
Other future sensitive operations only when necessary
```

Every Worker request follows:

```text
REQUEST
        │
        ▼
VALIDATE
        │
        ▼
RATE LIMIT / REQUIRED SECURITY CHECK
        │
        ▼
PERFORM REQUIRED ACTION
        │
        ▼
RETURN
```

The Worker must not wait for user actions.

The Worker must not run background processing.

The Worker must not process tracking events.

The Worker must not perform admin actions.

The Worker must not sit between Next.js and Supabase during SSG or ISR.

The Worker must not proxy normal catalog reads.

The Worker must not proxy normal profile, cart, wishlist, or address operations.

Do not add Next.js API routes as an unnecessary extra backend layer.

---

# 23. Tracking Architecture

Tracking is fully separate from the Worker.

The tracking flow is:

```text
USER ACTIVITY
        │
        ▼
FRONTEND EVENT QUEUE
        │
        ▼
BATCH EVENTS
        │
        ▼
TRACKING INGEST API
(Render)
        │
        ▼
TiDB CLOUD
RAW EVENTS
        │
        ▼
PROCESSOR
(Render, cron-triggered)
        │
        ▼
AGGREGATE NEW EVENTS ONLY
        │
        ▼
CALCULATE READY RESULTS
        │
        ▼
SUPABASE
        │
        ▼
NEXT.JS CONSUMES READY DATA
```

The storefront never waits for tracking.

Tracking failure must not break browsing, products, checkout, or rendering.

---

# 24. Frontend Event Collection

Do not send one request per event.

Events enter a bounded browser queue.

The queue batches events and sends them efficiently.

Each event has a unique event ID.

If delivery fails:

```text
KEEP EVENT
        │
        ▼
RETRY LATER
```

Use controlled retry behavior.

Do not retry forever.

Do not allow unlimited browser storage.

Do not block navigation waiting for analytics.

Low-value events may be discarded when the bounded queue reaches its limit.

The tracking endpoint must remain lightweight.

---

# 25. Tracking Ingest Backend

Host the tracking ingest API on Render.

Its responsibility is only:

```text
Receive batch
Validate batch
Deduplicate
Bulk insert into TiDB
Return
```

It does not calculate metrics.

It does not calculate circulation.

It does not write raw events to Supabase.

It remains stateless.

Use efficient asynchronous request handling and bounded database concurrency.

Do not add Redis, Kafka, RabbitMQ, or another queue.

Do not create a persistent in-memory event queue.

---

# 26. TiDB Event Storage

TiDB stores raw tracking events.

Events are append-oriented and indexed for incremental processing.

Each event has:

```text
Internal ordered event key
Unique event ID
Event type
Occurred time
Received time
Relevant product/category identifiers
Minimal user/session context when required
```

Store only data required for analytics and circulation.

Do not store unnecessary PII.

Do not store huge browser payloads.

Do not store complete request headers.

Do not store redundant data repeatedly.

Raw events must have a retention strategy so the event store does not grow forever.

---

# 27. Incremental Tracking Processor

Host the processor separately on Render.

Cron wakes it when processing is required.

The processor never scans the full event history repeatedly.

Use a persistent checkpoint.

```text
CHECKPOINT
        │
        ▼
READ ONLY EVENTS AFTER CHECKPOINT
        │
        ▼
PROCESS BATCH
        │
        ▼
WRITE RESULTS
        │
        ▼
ADVANCE CHECKPOINT
        │
        ▼
REPEAT UNTIL CAUGHT UP
```

The checkpoint advances only after the corresponding processing work succeeds.

Never advance the checkpoint before results are safely persisted.

Do not load all unprocessed events into memory.

Process bounded batches.

The processor must use a persistent lock to prevent overlapping cron runs from processing the same work.

If another processor run already owns the lock, exit safely.

The lock must recover after crashes.

Do not rely on Render local storage for locks or checkpoints.

---

# 28. Tracking Processing Output

The processor turns raw events into compact useful data.

The processor owns the circulation decisions.

Next.js does not recalculate scores.

The processor produces:

```text
Compact product metrics
Ready circulation results
Prepared product ordering for surfaces
```

Supabase stores only the ready-to-consume output needed by the storefront.

Do not copy the entire raw event history into Supabase.

The processor may aggregate multiple event types into compact product-level metrics.

---

# 29. Published Result Safety

Never expose half-written circulation results.

The flow is:

```text
CURRENT PUBLISHED VERSION
        │
        ▼
PROCESSOR BUILDS NEW VERSION
        │
        ▼
WRITE COMPLETE NEW RESULT SET
        │
        ▼
SUCCESS?
        │
        ├── NO → keep old published version
        │
        └── YES → publish new version
```

Next.js reads only a complete published version.

If processing fails, the last good result remains available.

---

# 30. Render Processing Trigger

Use cron-job.org to trigger the processor.

The processor endpoint must be protected.

The cron trigger starts a short processing run.

```text
CRON
        │
        ▼
PROCESSOR ENDPOINT
        │
        ▼
ACQUIRE LOCK
        │
        ▼
READ CHECKPOINT
        │
        ▼
PROCESS NEW EVENTS
        │
        ▼
PUBLISH SUCCESSFUL RESULTS
        │
        ▼
RETURN
```

Do not keep the processor permanently running.

Do not depend on Render local persistence.

The system must safely tolerate Render restarts and sleeping.

---

# 31. Ready Data Consumption

Next.js reads ready tracking output directly from Supabase.

The frontend never reads TiDB.

The frontend never calls the processor.

The home page and default catalog surfaces consume published circulation results during SSG/ISR.

```text
SUPABASE
        │
        ├── Current products
        ├── Offers
        └── Published circulation data
                │
                ▼
NEXT.JS GENERATION
                │
                ▼
COMPLETE HTML
                │
                ▼
CDN
```

The ready result determines product selection/order.

Current catalog data remains authoritative for product validity.

If a prepared product is now inactive or unavailable, skip it.

Do not trigger tracking processing because a product was skipped.

If ready data is missing, use a simple stable catalog fallback.

---

# 32. Product Circulation Rules

Circulation controls discovery order.

It must not permanently suppress products.

The processor should support product rotation and discovery.

New active products must receive an opportunity for exposure.

Low-engagement products must not become permanently unreachable solely because engagement is lower.

The final circulation result is consumed as prepared data.

Next.js does not recreate the ranking algorithm.

---

# 33. Database and Schema Delivery

Use the test Supabase project for development and validation.

Do not silently create or modify the production database.

Provide the complete Supabase schema and migration SQL for execution.

The implementation must clearly separate:

```text
Supabase schema
RLS policies
Indexes
Functions/RPC only where genuinely required
Seed data
TiDB schema
Tracking processor state
```

Use built-in Supabase and PostgreSQL capabilities where they solve the problem.

Do not create custom backend logic for functionality already safely handled by Supabase.

The real database schema must support the complete system before the mock layer is removed.

---

# 34. Seed Data

Create development seed data in the real schema.

Seed:

```text
Categories
Products
Product images
Offers
Circulation fallback data if required
Test user-facing catalog relationships
```

The existing UI must work with this real seed data without special mock adapters.

Seed data is for testing the actual production data flow.

Do not hardcode seed product data inside frontend components.

---

# 35. Frontend Client Boundaries

Keep Client Components narrow.

A component becomes client-side only when it actually needs browser state, event handlers, Supabase client interaction, or other browser APIs.

Examples that may require client boundaries:

```text
Forms
Authentication actions
Cart interaction
Wishlist interaction
Filtering
Sorting
Search interaction
Dynamic user-specific data
Checkout interaction
Tracking queue
```

The surrounding page and static layout remain server-rendered.

Do not create unnecessary `Client` wrapper components merely to group code.

Use normal component names.

Add `"use client"` only to the specific component that genuinely needs it.

Do not place `"use client"` in page files unless the entire page genuinely requires client rendering.

---

# 36. Loading Behavior

Keep the existing global premium loading behavior.

Do not add unnecessary in-page loading screens.

The global navigation loading indicator should appear only when a navigation genuinely takes long enough to be noticeable.

Do not permanently show it after one slow navigation.

Do not attempt to detect ISR execution or server rendering state.

Use a simple perceived-delay approach so fast navigations remain visually instant.

Dynamic client data areas may show local loading states only where data genuinely needs to load.

Do not cover the entire page with loaders when only one component is loading.

---

# 37. SEO Rules

Catalog and SEO content must remain server-rendered.

Important page text must exist in the HTML.

Product pages must contain actual product content in the generated HTML.

Product images must be directly represented in page markup using their real URLs.

Do not hide important product content behind client-only rendering.

Do not require JavaScript for search engines to discover basic product page content.

Do not turn catalog pages into authenticated or client-only pages.

---

# 38. Route Boundaries

Keep SEO/catalog pages separate from user-specific routes.

Use the existing project structure direction.

Catalog pages remain under the static/catalog area.

User-specific pages remain separate.

Orders must not be nested under the account route merely because they belong to authenticated users.

Keep checkout and order routes separate from account routes.

Do not create duplicate route structures for the same feature.

Do not leave redundant folders from the old implementation.

Remove unused directories such as abandoned database layers, examples, downloads, Prisma, or other unused infrastructure.

---

# 39. Hard No-To-Do Rules

The AI must not drift from these rules.

Do not redesign the existing premium UI.

Do not simplify the UI because real backend data is missing during implementation.

Use real seed data and complete simulations where necessary.

Do not replace the current visual system with generic AI-generated UI.

Do not make whole pages Client Components.

Do not use the Worker as a general Supabase proxy.

Do not use the Worker for SSG, ISR, or normal product reads.

Do not use the Worker for tracking.

Do not use the Worker for admin actions.

Do not create Next.js API routes unless a concrete requirement cannot be handled by the defined architecture.

Do not create a custom authentication system.

Do not create custom JWTs.

Do not create custom session refresh.

Do not make the Worker wait for OTP or onboarding.

Do not keep long-lived user state inside Worker memory.

Do not proxy normal sign-in through the Worker.

Do not proxy normal RLS-protected user data through the Worker.

Do not send every tracking event directly to Supabase.

Do not send one tracking request per event.

Do not make Next.js wait for the tracking processor.

Do not allow the processor to rescan all historical events every run.

Do not advance the tracking checkpoint before successful persistence.

Do not allow overlapping processor runs to process the same range.

Do not delete the last good circulation results before replacement succeeds.

Do not add Redis, Kafka, RabbitMQ, or unnecessary queue infrastructure.

Do not trust prices, totals, offers, stock decisions, or address ownership from the browser during order creation.

Do not create COD duplicate orders.

Do not clear the cart before confirmed order success.

Do not make historical orders depend on current addresses or current product prices.

Do not implement a payment gateway.

Do not build a generic payment abstraction for a single COD method.

Do not expose privileged Supabase credentials to the browser.

Do not allow public clients to modify production listings.

Do not let one authenticated account access another account's data.

Do not leave account-specific browser cache visible after sign-out or account switching.

Do not keep the mock system beside the real system after migration.

Do not create duplicate data models for mock and real data.

Do not overengineer.

Do not add abstractions without a concrete requirement.

Do not replace a simple built-in Supabase capability with custom code.

Prefer the shortest reliable implementation that preserves the exact required behavior.

---

# 40. Implementation Order

Build in this order:

```text
1. Inspect existing frontend and map every mock dependency
        ↓
2. Define complete real data model and SQL migrations
        ↓
3. Define RLS and product read-only boundaries
        ↓
4. Create real seed data
        ↓
5. Implement Supabase client/data access
        ↓
6. Migrate catalog, offers, and static pages from mock data
        ↓
7. Implement authentication and onboarding
        ↓
8. Implement account-scoped cache isolation
        ↓
9. Implement cart and wishlist with guest-to-account merge
        ↓
10. Implement checkout and COD order creation
        ↓
11. Implement Cloudflare Worker sensitive endpoints
        ↓
12. Implement TiDB tracking schema
        ↓
13. Implement Render tracking ingest API
        ↓
14. Implement incremental tracking processor
        ↓
15. Publish ready tracking output to Supabase
        ↓
16. Connect ISR pages to ready circulation data
        ↓
17. Remove the mock system completely
        ↓
18. Test every flow end-to-end
```

Do not skip infrastructure because the UI currently works with simulated data.

Do not start randomly connecting components one by one without first defining the real schema and ownership boundaries.

The existing UI is the presentation layer. The task is to build the complete real system behind it while preserving that presentation layer.

```
```
