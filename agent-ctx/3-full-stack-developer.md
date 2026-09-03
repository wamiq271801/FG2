# Task ID: 3 — full-stack-developer — Admin ⇄ Storefront notification integration (Phases F+G+H)

Scope: ONLY `/home/z/my-project/admin/**` (separate Next 16.1.3 app, basePath /admin,
port 3001). No storefront files touched. Frozen contract honored exactly
(`StorefrontEvent` union, POST /api/revalidate, Bearer secret, `{"success":true|false,...}`).

## Files created
- `admin/lib/notify-types.ts` — client-safe: `StorefrontEvent` union + strict zod v4
  discriminated-union schema (`z.strictObject`, `z.uuid()`, compile-time schema/type
  assertion), isomorphic base64URL codec (`encodeEvent`/`decodeEvent` — btoa/atob +
  TextEncoder/TextDecoder work in both Node and browser), `withNotifyFailed()` /
  `readNotifyMessage()` URL helpers.
- `admin/lib/notify.ts` — server-only notifier: exactly ONE fetch, 10s AbortController
  timeout, ok ⇔ HTTP ok AND body.success === true, `{ ok:false, message }` on any
  failure (missing secret → config message, never throws). Re-exports the event type.
- `admin/app/(protected)/notify-actions.ts` — `retryNotificationAction(prev, formData)`:
  zod-strict decode of the `evt` field, ONE new notify attempt, `redirectTo` sanitized
  to same-app paths, success → redirect(redirectTo) or success state; failure → error
  state. Never auto-retries.
- `admin/components/NotifyBanner.tsx` — client component in the ui.tsx style
  (warn tone, `SubmitButton`, lucide `AlertTriangle`): "Database updated — storefront
  notification FAILED: <message>" + [Retry Invalidation] form (hidden base64 evt +
  optional redirectTo). After a successful in-form retry it swaps to a success message.

## Files modified
- `admin/lib/env.ts` — `requireStorefrontRevalidateUrl()` (default fallback) +
  `requireStorefrontRevalidateSecret()` (throws like the other require* helpers;
  notify catches it → failed NotifyResult, never an exception in a mutation).
- `admin/lib/data/reviews.ts` — `setReviewStatus` now `.select("product_id")` and
  returns it (null when no row matched); MigrationRequiredError behavior intact.
- `admin/app/(protected)/products/actions.ts` — rewritten: all `revalidatePath` gone;
  events after DB success per spec (`product.created`; `product.updated` with
  previousSlug/previousCategoryId captured via getProduct BEFORE mutation; archive/
  activate/images → `product.updated`; delete → pre-fetch slug+category then
  `product.deleted`); redirect-based actions add `?notifyFailed=1&evt=<base64url>
  &msg=<urlencoded>` on notify failure; `refreshProductAction` (product.refresh).
  `ProductFormState` extended with the dbSuccess/notify/event/retryRedirectTo variant.
- `admin/app/(protected)/categories/actions.ts` — same pattern (`category.*`,
  `refreshCategoryAction`); `CategoryFormState` extended.
- `admin/app/(protected)/reviews/actions.ts` — `ModerationState` = `{error} | null |
  {dbSuccess, notify, event}`; approve/reject notify `review.approved`/`review.rejected`
  with the resolved productId; `refreshReviewAction` sends `review.refresh` with NO
  productId and preserves the status tab + page.
- `admin/app/(protected)/products/ProductForm.tsx`, `categories/CategoryForm.tsx` —
  render the NotifyBanner for the dbSuccess state (create keeps retryRedirectTo).
- `admin/app/(protected)/reviews/ReviewRowActions.tsx` — renders the NotifyBanner for
  the in-row moderation notify failure.
- Pages: `products/[id]/page.tsx` + `categories/[id]/page.tsx` (Revalidate-storefront
  button next to archive/delete + notifyFailed/refreshed banners, evt decoded
  server-side), `products/page.tsx` + `categories/page.tsx` (delete-flow retry banner
  + deleted success banner), `reviews/page.tsx` (header Revalidate-storefront control,
  banners preserving tab/page).

## Invariants verified
- No `revalidatePath`/`revalidateTag`/`next/cache` anywhere in admin (grep).
- Secret value absent from all admin source, URLs, and messages; only `lib/env.ts`
  reads it; no NEXT_PUBLIC vars.
- zod v4 API validated by script (strict objects reject extra keys; discriminated
  union rejects unknown types).
- Codec round-trip: all 12 event variants pass; garbage/extra-field/unknown-type
  events decode to null; evt survives real Next searchParams (`+`/`=`-safe base64url).
- Notifier mock-tested: 404 → "storefront rejected the notification (Not found)";
  200+success → ok; hanging endpoint → 10s abort; missing secret → config failure
  without request.
- `bunx tsc --noEmit` = 0 errors; `bunx eslint .` = 0 problems.
- Live render checks with a self-signed session cookie: /admin/login 200;
  /admin/products 307→login; authenticated product/category/review pages 200 with
  NotifyBanner (Retry Invalidation present), refreshed banners, invalid evt → no
  banner; zero errors in admin-dev.log.
- Storefront endpoint currently unreachable/404 (main agent building it in parallel) —
  handled gracefully as the notify-failed path (by design).

## Ops note for the main agent
The admin dev server had wedged (not accepting TCP for ~20 min under storefront
compile load) and the original dev-orchestrator process had already died (children
orphaned to init). Killed the wedged admin server and restarted the root orchestrator
detached (double-fork, survives the agent shell). Orchestrator is idempotent: skipped
the running storefront, restarted admin on :3001 with admin/.env.local loaded.
Storefront process untouched. A stray `orchestrator-recovery.log` at the project root
holds the orchestrator's stdout (the platform normally logs this through its own dev
runner).

## Deviations (with reasons)
1. Added `msg` query param (urlencoded, %-stripped, ≤200 chars) next to `evt` on
   notify-failed redirects — the banner's "<message>" copy cannot survive a redirect
   otherwise (stateless notifier, no server state allowed).
2. evt uses unpadded base64URL rather than std base64 — immune to query-string
   "+"/percent-decoding hazards; same strictness, self-contained codec.
3. `retryNotificationAction` signature is `(prev, formData)` (useActionState) —
   same form-field contract, enables in-place failure/success rendering.
4. `setReviewStatus` returns `null` (not an error) when 0 rows matched; the action
   surfaces "Review not found". `deleteProductAction`'s pre-fetch failure redirects
   with `error=delete-failed` before any mutation.
