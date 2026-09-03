# Phase 2 — Public-Catalog Caching & Invalidation Architecture

This is the implemented target architecture for the coordinated
storefront (main website) + admin system. The main website owns the cache
and the invalidation system; the admin owns domain mutations and acts
only as a domain-change notifier.

## Page classification (hard boundaries)

| Class | Pages | Architecture |
|---|---|---|
| A — Static informational | /about, /privacy, /terms, /contact, /shipping, /returns | Build-time static output. No cache tags, no events, no runtime catalog queries. |
| B — User-specific | /account, /cart, /wishlist, /orders, /checkout, /auth/*, /addresses | Static shell + client-side data loading. Never public-cache-scoped. (Cart/wishlist shells render per request; their client islands are untouched.) |
| C — Public catalog | /, /shop, /categories, /categories/[slug], /product/[slug], /offers, /products/[slug]/reviews*, sitemaps, footer | Cached public data scopes + explicit tag invalidation (below). Search stays client-driven/dynamic. |

## Freshness model

`CACHE → remain cached → domain change / explicit refresh → on-demand
tag invalidation → next request obtains fresh data → fresh result cached
again.`

- **NO periodic/time-based server revalidation.** The TTL-driven
  `cacheLife` profiles of the previous architecture are removed. The
  `cacheLife` profiles in `next.config.ts` are replaced by one
  `"indefinite"` profile: `{ stale: 300, revalidate: Infinity, expire:
  Infinity }` — entries never revalidate or expire by time; they are
  dropped only by `revalidateTag`.
- Volatile stock is NEVER part of any shared cache (see Stock below).

## Cache boundaries (storefront data scopes)

Every `'use cache'` scope, its inputs, dependencies and tags:

| Scope | Function | Inputs | Output | Tags | Invalidated by |
|---|---|---|---|---|---|
| Product detail | `getProductBySlug(slug)` | slug | Product (detail, **sans stock**) | found: `product:{id}`, `category:{categoryId}`; miss: `product-slug:{slug}` | `product.*`, `category.updated/deleted/refresh` of its category |
| Product card dataset | `getAllProductCards()` | — | Product[] (card, **sans stock**) | `products` + `category:{id}` for every distinct category present | `product.*`, `category.*` |
| Categories list | `getAllCategories()` | — | Category[] | `categories` | `category.*` |
| Category detail | `getCategoryBySlug(slug)` | slug | Category | found: `category:{id}`, `category-slug:{slug}`; miss: `category-slug:{slug}` | `category.*` |
| Brands list | `getAllBrands()` | — | Brand[] | `brands` | no mutation path exists (read-only domain) |
| Home feed | `getFeedSurfaceIds(surface, limit)` | surface, limit | ordered product IDs only | `feed:home` | feed domain only — no admin feed path exists; product events never touch it |
| Public reviews (PDP) | `getReviewData(productId)` | productId | `{ summary, latest }` | `reviews:{productId}`, `reviews` | `review.approved / rejected / updated / refresh` |
| Paginated reviews | `getPaginatedReviews(productId, page)` | productId, page | page of reviews | `reviews:{productId}`, `reviews` | same |
| Offers list | `getAllPromotions()` | — | Promotion[] | `offers` | no mutation path exists |
| Offer by slug | `getPromotionBySlug(slug)` | slug | Promotion | `offers`, `offer:{slug}` | no mutation path exists |
| Offers for product | `getActiveOffersForProduct(productId)` | productId | Promotion[] | `offers`, `offer:{slug}` × found | no mutation path exists |
| Footer | `SiteFooter` cache component | — | footer markup (categories + year) | `categories` (explicit + via nested `getAllCategories`) | `category.*` |
| Sitemap index counts | `getSitemapIndexCounts()` | — | counts | `sitemap:products`, `sitemap:categories` | `product.*`, `category.*` |
| Product sitemap batch | `getProductSitemapRows(batch)` | batch | urlset rows | `sitemap:products` | `product.created/updated/deleted` (route-visible changes) |
| Category sitemap batch | `getCategorySitemapRows(batch)` | batch | urlset rows | `sitemap:categories` | `category.*` |

NOT cached (per-request, live): stock/availability reads
(`getStocks`), related-product membership (derived from the cached
dataset + a live variation-membership read), variation membership
queries, shop/category availability filtering (uses the live stock
overlay), user data, search.

Pages are **uncached server renders** that assemble the cached scopes
above (plus live stock). No page-level `'use cache'` remains on catalog
pages — granular invalidation happens at the data-scope level, so an
invalidated scope rebuilds without touching unrelated scopes (e.g. a
review approval never drops the product-detail entry; a product edit
never drops `feed:home`).

### Nesting rule (verified against Next 16.1.3 source)

Nested `'use cache'` scopes propagate inner tags to the outer entry
(`propagateCacheLifeAndTagsToRevalidateStore`). Therefore no cached scope
may consume another cached scope unless that dependency is intentional
(e.g. the footer intentionally depends on `categories`). The feed scope
in particular performs its own product-selection queries so that product
changes can never leak into `feed:home`.

## Stock / availability architecture

- Stock is excluded from every cached select. `Product.stock` /
  `Product.availability` are optional and unset for cached data.
- PDP render performs one **live** batched stock read
  (`getStocks([product.id, ...variationSiblingIds])`) for the initial
  server-rendered availability, purchase controls and JSON-LD
  `offers.availability` (SEO preserved).
- After hydration, a small client boundary (`useStock` +
  `GET /api/stock?ids=…`) re-fetches ONLY `{ stock, isActive, isPreorder,
  availability }` per product id (batched, in-flight-deduped, one request
  per page) and updates ONLY the availability UI.
- Shop and category pages merge a live stock overlay at render time so
  availability **filtering** operates on live values.
- No stock cache. No stock tags. No stock events. No polling — one
  hydration-time refresh only. Orders never trigger storefront
  invalidation.

## Event vocabulary (admin → storefront)

```
product.created  { productId }
product.updated  { productId, previousSlug?, previousCategoryId? }
product.deleted  { productId, slug?, previousCategoryId? }
product.refresh  { productId }

category.created { categoryId }
category.updated { categoryId, previousSlug? }
category.deleted { categoryId, slug? }
category.refresh { categoryId }

review.approved  { productId }
review.rejected  { productId }
review.updated   { productId }
review.refresh   { productId? }   // no productId = whole review domain
```

The admin never sends cache tags and never learns the storefront's tag
topology. Manual refresh and retry use the exact same events and the
same notification path as automatic mutations — one system.

## Storefront invalidation endpoint

`POST /api/revalidate` (main website, server-only):

1. Authenticate: `Authorization: Bearer <REVALIDATE_SECRET>`
   (timing-safe compare; secret lives only in server env files).
2. Validate the event body strictly (zod). No arbitrary tags accepted.
3. Resolve affected cache tags via the invalidation policy (the
   storefront may query its own database to resolve, e.g., a product's
   current slug/category).
4. Call `revalidateTag(tag)` for each resolved tag.
5. Respond `{ success: true }` or `{ success: false, error }` — no tags
   or internals leaked.

## Invalidation policy (storefront-owned)

| Event | Resolved tags |
|---|---|
| `product.created` | `product:{id}`, `product-slug:{slug}`, `products`, `sitemap:products` |
| `product.updated` | `product:{id}`, `product-slug:{slug}` (+ `product-slug:{previousSlug}`), `products`, `sitemap:products` |
| `product.deleted` | `product:{id}`, `product-slug:{slug}` (from event), `products`, `sitemap:products` |
| `product.refresh` | same as `product.updated` (without diff fields) |
| `category.created` | `categories`, `category:{id}`, `category-slug:{slug}`, `sitemap:categories` |
| `category.updated` | `categories`, `category:{id}`, `category-slug:{slug}` (+ old), `sitemap:categories`. Product-detail entries of that category are invalidated through their `category:{id}` tag. |
| `category.deleted` / `category.refresh` | same shape (delete uses the event's slug) |
| `review.*` (with productId) | `reviews:{productId}`, `reviews` |
| `review.refresh` (no productId) | `reviews` |

Feed independence guarantees: `feed:home` appears in **no** product or
category event's tag list; product data tags appear in no feed event.
Only feed domain logic may invalidate `feed:home` (no such mutation path
exists in this phase — the circulation/feed source is read-only today).

## Admin mutation + notification flow

```
Admin UI → Server Action → requireSession() → privileged Supabase mutation
→ mutation succeeds → notifyStorefront(event)   // one attempt, no retry loop
→ result surfaced: DB SUCCESS + NOTIFICATION FAILED (if so) → [Retry Invalidation]
```

- The DB mutation is never rolled back when notification fails
  (Supabase stays the source of truth).
- Retry is an explicit, operator-triggered new attempt through the same
  notifier + endpoint — never automatic, never queued.
- The obsolete `revalidatePath("/", "layout")` calls in the admin are
  removed (admin-local revalidation never affected the storefront).
- Admin UI communicates domain intent ("Revalidate storefront"), never
  cache tags.

## Environmental keys

- Storefront (server-only): `REVALIDATE_SECRET` (`.env` / `.env.local`).
- Admin (server-only): `STOREFRONT_REVALIDATE_URL`
  (default `http://127.0.0.1:3000/api/revalidate`),
  `STOREFRONT_REVALIDATE_SECRET`.
- Secrets are never `NEXT_PUBLIC_*`, never in client code, HTML, URLs or
  logs.

## Documented limitations (honest scope)

- The Phase 1 review-moderation migration is not applied to the live
  test database (DDL cannot be executed from this sandbox); review
  moderation end-to-end against the live DB activates once the
  migration is applied manually. The notification/invalidation system
  is fully implemented and testable for products and categories.
- Offers have no admin mutation path, so no offer events exist; offer
  scopes are tagged for future use and are simply not invalidated.
- The homepage feed fallback (used while `circulation_entries` is
  unpublished) bakes its editorial rotation at cache-fill time; without
  periodic revalidation the rotation is frozen until the feed is
  invalidated by future feed-domain logic. This is the explicit
  trade-off of the no-TTL model required by this phase.
