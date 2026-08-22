# Worker, Order, and Inventory Audit

**Project:** Fusion Gadgets  
**Supabase project:** `onyzjnitnekjhdexecdm`  
**Audit date:** August 2026  
**Scope:** Read-only. No code or schema was modified.  
**Method:** Full source read of every relevant Worker file + live Supabase MCP inspection of all tables, functions, triggers, indexes, RLS policies, and grants.

---

## Table of Contents

1. [Section 1 — Worker File Map](#section-1--worker-file-map)
2. [Section 2 — Route Inventory](#section-2--route-inventory)
3. [Section 3 — Authentication and Account Flow Audit](#section-3--authentication-and-account-flow-audit)
4. [Section 4 — Order Creation Trace](#section-4--order-creation-trace)
5. [Section 5 — Inventory / Stock Audit](#section-5--inventory--stock-audit)
6. [Section 6 — Database Object Inventory](#section-6--database-object-inventory)
7. [Section 7 — Order Status Lifecycle](#section-7--order-status-lifecycle)
8. [Section 8 — Error Handling and Response Contract](#section-8--error-handling-and-response-contract)
9. [Section 9 — Rate Limit Audit](#section-9--rate-limit-audit)
10. [Section 10 — Trust Boundary Map](#section-10--trust-boundary-map)
11. [Section 11 — Redundancy and Stale Code Audit](#section-11--redundancy-and-stale-code-audit)
12. [Section 12 — Findings Priority Table](#section-12--findings-priority-table)
13. [Section 13 — Recommended Rewrite Boundaries](#section-13--recommended-rewrite-boundaries)
14. [Section 14 — Flow Diagrams](#section-14--flow-diagrams)

---

## Section 1 — Worker File Map

### Physical structure verified

```
worker/
├── package.json
├── wrangler.toml
└── src/
    ├── config/
    │   └── env.ts
    ├── dev.ts
    ├── index.ts
    ├── lib/
    │   ├── response.ts
    │   ├── signup-auth.ts
    │   ├── supabase.ts
    │   ├── turnstile.ts
    │   └── validation.ts
    ├── middleware/
    │   ├── auth.ts
    │   └── rate-limit.ts
    ├── routes/
    │   ├── auth.ts
    │   └── orders.ts
    └── services/
        ├── auth.service.ts
        └── orders.service.ts
```

### File-by-file analysis

#### `src/index.ts`

- **VERIFIED FACT:** Single entry point. Calls `resolveEnv(env)`, then dispatches to `authRoutes()` and `orderRoutes()` in sequence. Returns `fail("NOT_FOUND", ...)` for unmatched paths.
- **VERIFIED FACT:** Handles `OPTIONS` via `corsPreflight()`. Handles `GET /health` inline.
- **Clear responsibility:** Yes — pure dispatch. No logic leaks.
- **CORS policy:** `access-control-allow-origin: *` (open). No per-origin restriction.

#### `src/dev.ts`

- **VERIFIED FACT:** Uses `Bun.serve()` to wrap `worker.fetch()` on port 8787.
- **Purpose:** Local development alternative to `wrangler dev` for teams using Bun runtime.
- **`package.json` scripts:** Only `"dev": "wrangler dev"` and `"deploy": "wrangler deploy"`. `dev.ts` is **not referenced in any script**.
- **Imported by:** Nothing — no file imports `dev.ts`.
- **`wrangler.toml` main:** Points to `src/index.ts`. `dev.ts` is not the wrangler entry.
- **POSSIBLE REDUNDANCY:** `dev.ts` is unreachable via npm scripts and is not wrangler's entry. It exists as a manual Bun alternative but is never invoked in normal workflow.
- **Does NOT duplicate `index.ts`:** It wraps it, so it is a thin adapter, not a duplicate. However, it is unused in the documented workflow.

#### `src/config/env.ts`

- **VERIFIED FACT:** Defines the `Env` interface and `resolveEnv()`. Hardcodes test project fallback values for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY`.
- **SECURITY RISK:** The service-role key is hardcoded as a plaintext fallback. If a deployment occurs without setting `SUPABASE_SERVICE_ROLE_KEY` as a wrangler secret, the hardcoded test key ships to production. The test project is live (`onyzjnitnekjhdexecdm`), not a throwaway sandbox.
- **Turnstile secret default:** Also hardcoded — same risk for Turnstile.
- **`WORKER_INTEGRITY_SECRET`:** Referenced in `wrangler.toml` comment as a planned secret but **not in the `Env` interface or `resolveEnv()`**. It appears in the wrangler comment as a future capability. Currently unused.

#### `src/lib/response.ts`

- **VERIFIED FACT:** Exports `json()`, `success()`, `fail()`, `corsPreflight()`.
- **Contract:** `fail(code, title, status=422)` → `{ success: false, error: { code, title } }`. `success(data=null)` → `{ success: true, data }`.
- **CORS headers:** Set on every response including errors. Origin is `*`.
- **Single responsibility:** Yes. All response shaping goes through this module.

#### `src/lib/supabase.ts`

- **VERIFIED FACT:** Exports `supabaseSignup()`, `supabaseAuthFetch()`, `supabaseRestFetch()`, `verifyUser()`.
- **`supabaseSignup()`:** Uses anon key only. No service-role. Sends to `/auth/v1/signup`.
- **`supabaseAuthFetch()`:** Uses service-role key. Sends to any `/auth/v1/*` path with `Authorization: Bearer <service_role>`.
- **`supabaseRestFetch()`:** Uses service-role key. Used for REST API calls (PostgREST) and RPC calls.
- **`verifyUser()`:** Validates a Bearer token from the incoming request against `/auth/v1/user`. Uses service-role `apikey` header but forwards the user's actual JWT as `Authorization`. This correctly validates the user's session without trusting the client's claimed identity.
- **STRUCTURAL PROBLEM:** `supabase.ts` mixes three distinct concerns: signup (auth-specific), generic auth endpoint calls, generic REST/RPC calls, and user identity verification. These serve different trust layers but share one file. Not a bug, but a structural observation for the rewrite.
- **Timeout:** `DEFAULT_TIMEOUT = 10000ms` applied to `supabaseSignup` and `supabaseAuthFetch`. `supabaseRestFetch` has **no timeout**. If the Supabase REST endpoint hangs, the Worker hangs.

#### `src/lib/signup-auth.ts`

- **VERIFIED FACT:** Exports `sha256Hex()`, `normalizeEmail()`, `emailHash()`, `generateAuthorizationToken()`, `createSignupAuthorization()`.
- **Token generation:** 32 bytes from `crypto.getRandomValues()` → URL-safe base64. 256-bit entropy. Correct.
- **Hashing:** `crypto.subtle.digest("SHA-256")` → manual hex loop. Produces lowercase hex. Matches the hook's `encode(extensions.digest(...), 'hex')`.
- **Email normalization:** `trim().toLowerCase()`. Matches hook's `lower(trim(...))`.
- **`createSignupAuthorization()`:** Calls `supabaseRestFetch` with service-role. No timeout. POSTs to `/rest/v1/signup_authorizations`.
- **Single responsibility:** Yes — signup authorization gate cryptography and persistence only.

#### `src/lib/turnstile.ts`

- **VERIFIED FACT:** Exports `verifyTurnstile()` and `TURNSTILE_ACTION = "signup"`.
- **Action check:** Only enforced when `data.action` is present in the Cloudflare response. Test key pairs omit the action field — this is documented in the comment and is the correct behavior.
- **Hostname check:** Only enforced when `env.TURNSTILE_EXPECTED_HOSTNAME` is non-empty. Default is empty string (no hostname enforcement in current dev config).
- **Timeout:** 8000ms. Catches and returns `false` on abort/network error.
- **Single responsibility:** Yes.

#### `src/lib/validation.ts`

- **VERIFIED FACT:** Exports `isValidEmail()`, `normalizeEmail()`, `validatePassword()`, `validateRegistration()`, `validateEmailOnly()`, `validateOrderRequest()`.
- **Password policy (Worker):** min 8, max 72, ≥1 uppercase, ≥1 digit, ≥1 non-alphanumeric.
- **Order validation:** Only validates `addressId` (non-empty string) and `idempotencyKey` (non-empty, max 100 chars). Does NOT validate cart contents, quantities, product slugs, or prices — these are all left to the database RPC.
- **STRUCTURAL PROBLEM:** `normalizeEmail()` is duplicated in both `validation.ts` and `signup-auth.ts`. Both implement `email.trim().toLowerCase()`. They are identical and serve the same semantic purpose. `auth.service.ts` calls `validateRegistration()` which normalizes via `validation.ts`, then passes the already-normalized email to `emailHash()` in `signup-auth.ts` which normalizes again. Double normalization is idempotent and harmless, but the duplication is a cleanup candidate.

#### `src/middleware/auth.ts`

- **VERIFIED FACT:** Single export `requireAuth()` which delegates entirely to `verifyUser()` from `lib/supabase.ts`.
- **This is a pass-through with no added logic.** The middleware layer adds zero value over calling `verifyUser()` directly.
- **POSSIBLE REDUNDANCY:** `requireAuth` is a one-line wrapper. Its only caller is `orders.service.ts`. The middleware abstraction exists but provides no middleware-level capabilities (no request modification, no context injection, no chaining).

#### `src/middleware/rate-limit.ts`

- **VERIFIED FACT:** Exports `checkRateLimit()` and `clientIp()`.
- **`checkRateLimit()`:** Calls `supabaseRestFetch` to invoke the `check_rate_limit` Supabase RPC. Returns `true` if allowed, `false` if rate-limited.
- **`clientIp()`:** Reads `cf-connecting-ip` first, then `x-forwarded-for` (first segment), then `"unknown"`. Cloudflare Workers reliably set `cf-connecting-ip` for deployed Workers. In dev via `wrangler dev`, this header may be absent.
- **No timeout on `supabaseRestFetch`:** Rate limit checks can hang indefinitely if Supabase is unreachable. If `checkRateLimit` throws or returns false due to a DB error, the Worker currently treats it as "rate limited" (returns false) — meaning a Supabase outage causes all rate-limited endpoints to fail closed (deny all), which is a safe default but may cause service unavailability.

#### `src/routes/auth.ts`

- **VERIFIED FACT:** Dispatches three paths to `auth.service.ts` handlers. Returns `null` for no match.
- **Single responsibility:** Yes — routing only, no logic.

#### `src/routes/orders.ts`

- **VERIFIED FACT:** Dispatches `POST /orders` to `handleCreateOrder`. Returns `null` for no match.
- **Single responsibility:** Yes.

#### `src/services/auth.service.ts`

- **VERIFIED FACT:** Handles `handleRegister`, `handleResendSignup`, `handleResetPassword`.
- **Mixed responsibilities:** Despite the name "auth service", this file contains three distinct business operations: account creation (registration), OTP resend (a verification flow), and password recovery initiation. These are operationally distinct enough to warrant separation in a rewrite.
- **`handleResetPassword`:** Always returns `success()` regardless of whether the Supabase recovery call succeeds. The result of `supabaseAuthFetch` to `/auth/v1/recover` is intentionally ignored. This is correct — it prevents email enumeration.

#### `src/services/orders.service.ts`

- **VERIFIED FACT:** `handleCreateOrder` authenticates via `requireAuth`, rate-limits, validates the request body, then calls the `create_order` RPC via `supabaseRestFetch` with service-role.
- **All order creation logic lives in the database RPC.** The Worker is an authenticated, rate-limited gateway only.
- **Error mapping:** The service maps RPC-returned `{ error: "CODE", ... }` strings to user-facing messages. The RPC returns error codes in the `data` field of a 200 response, not as HTTP errors.

---

## Section 2 — Route Inventory

### All registered routes

| Method | Path | Handler | Auth | Rate Limit | Turnstile | Service/DB |
|--------|------|---------|------|------------|-----------|------------|
| `OPTIONS` | `*` | `corsPreflight()` | None | None | None | None |
| `GET` | `/health` | Inline `"ok"` | None | None | None | None |
| `POST` | `/auth/register` | `handleRegister` | None | IP: 5/900s, email: 3/900s | Yes (server-side) | `signup_authorizations` INSERT, Supabase Auth signup |
| `POST` | `/auth/resend-signup` | `handleResendSignup` | None | Email: 3/86400s | No | Supabase `/auth/v1/resend` |
| `POST` | `/auth/reset-password` | `handleResetPassword` | None | Email+IP: 5/900s | No | Supabase `/auth/v1/recover` |
| `POST` | `/orders` | `handleCreateOrder` | Bearer JWT (Supabase) | user_id: 5/900s | No | `create_order` RPC (service-role) |

### Business responsibility classification

**Registration / account creation:** `POST /auth/register`  
**Email verification support:** `POST /auth/resend-signup`  
**Password recovery initiation:** `POST /auth/reset-password`  
**Order placement:** `POST /orders`

### Observations

- **VERIFIED FACT:** No sign-in backend route exists. Sign-in calls `supabase.auth.signInWithPassword()` directly from the browser via the Supabase JS SDK. The Worker does not participate in sign-in.
- **VERIFIED FACT:** No OTP verification route. OTP verification calls `supabase.auth.verifyOtp()` directly from the browser.
- **VERIFIED FACT:** No profile/onboarding route. Profile updates use the Supabase client directly from the browser via RLS.
- **VERIFIED FACT:** No session management route. Sessions managed entirely by Supabase Auth.
- **INCONSISTENCY:** `POST /auth/reset-password` performs no authentication check. Any unauthenticated caller can invoke it. Rate limiting is the only protection. This is intentional for account recovery flows but means the endpoint is reachable without registration.

---

## Section 3 — Authentication and Account Flow Audit

### 3.1 Registration Flow

```
Browser
  |
  | POST /auth/register
  | { email, password, turnstileToken }
  |
  v
Worker: handleRegister()
  |
  +-- clientIp(request)
  |
  +-- checkRateLimit("register:<ip>", 5, 900)
  |     |-- supabaseRestFetch → /rest/v1/rpc/check_rate_limit
  |     |-- [FAIL] → 429 RATE_LIMITED
  |
  +-- request.json() → validateRegistration(body)
  |     |-- email: trim+lower, regex
  |     |-- password: len, uppercase, digit, special
  |     |-- turnstileToken: non-empty trim
  |     |-- [FAIL] → 422 VALIDATION_ERROR
  |
  +-- checkRateLimit("register:<normalized_email>", 3, 900)
  |     |-- [FAIL] → 429 RATE_LIMITED
  |
  +-- verifyTurnstile(env, token, ip)
  |     |-- POST Cloudflare siteverify
  |     |-- checks: success=true, action=="signup" (if present), hostname (if configured)
  |     |-- [FAIL] → 422 TURNSTILE_FAILED
  |
  +-- generateAuthorizationToken()   [32 bytes crypto-random, URL-safe base64]
  +-- sha256Hex(token)               [SHA-256 via crypto.subtle]
  +-- emailHash(email)               [SHA-256 of lower(trim(email))]
  |
  +-- createSignupAuthorization(env, tokenHash, emailHash, ttl)
  |     |-- supabaseRestFetch POST /rest/v1/signup_authorizations  [service-role]
  |     |-- inserts: { token_hash, email_hash, expires_at = now()+300s }
  |     |-- [FAIL] → 502 SIGNUP_FAILED
  |
  +-- supabaseSignup(env, email, password, { reg_auth: rawToken })
        |-- POST /auth/v1/signup  [anon key]
        |-- body: { email, password, data: { reg_auth: rawToken } }
        |
        +-- Supabase: Before User Created Hook fires
        |     |-- hook_validate_signup_authorization(event)
        |     |-- extracts: event.user.email, event.user.user_metadata.reg_auth
        |     |-- computes: email_hash = SHA-256(lower(trim(email)))
        |     |-- computes: token_hash = SHA-256(reg_auth)
        |     |-- calls: consume_signup_authorization(email_hash, token_hash)
        |     |         UPDATE ... SET consumed_at=now()
        |     |         WHERE token_hash=? AND email_hash=?
        |     |           AND expires_at > now() AND consumed_at IS NULL
        |     |         RETURNING *
        |     |-- [NO ROW] → reject 403 "session expired"
        |     |-- [ROW FOUND] → return {}  (allow)
        |
        +-- [Supabase creates unconfirmed user]
        +-- [on_auth_user_created trigger fires → INSERT profiles(id, email)]
        +-- [Supabase sends 6-digit OTP email]
        +-- [signup() returns { user: {...}, session: null }]
        |
        |-- Worker maps Supabase errors:
        |     "already registered" → 409 EMAIL_EXISTS
        |     422 or "not authorized" → 422 SIGNUP_REJECTED
        |     400 + "captcha" → 500 SIGNUP_FAILED
        |     502 (network) → 502 SIGNUP_FAILED
        |     other → 500 SIGNUP_FAILED
        |
        v
  Worker returns: 200 { success: true, data: null }
  |
  Browser: toast + move to OTP verify step
```

**Security boundaries verified:**
- **VERIFIED FACT:** Raw authorization token is never returned to the browser. Worker returns only `{ success: true, data: null }` on success.
- **VERIFIED FACT:** Token hash and email hash stored in `signup_authorizations`. Raw token passed only internally to Supabase signup metadata.
- **VERIFIED FACT:** Hook runs in the database as `supabase_auth_admin`. Browser has no path to trigger or bypass it.
- **VERIFIED FACT:** Atomic consume via `UPDATE ... WHERE consumed_at IS NULL RETURNING *`. No SELECT-then-UPDATE race.
- **VERIFIED FACT:** Both IP and email are rate-limited separately. IP limit checked before the more expensive Turnstile call.

**Issues found:**
- **BUG:** If `createSignupAuthorization` succeeds but `supabaseSignup` fails, an unconsumed authorization row is left in `signup_authorizations`. It expires after 5 minutes (TTL enforced by the hook via `expires_at > now()`). No cleanup is needed — expiry handles it. **Not a bug, confirmed harmless.**
- **INCONSISTENCY:** `supabaseRestFetch` (used by `createSignupAuthorization`) has **no timeout**. If the Supabase REST endpoint is slow, the Worker hangs here indefinitely. `supabaseSignup` and `supabaseAuthFetch` both have 10s timeouts.

### 3.2 OTP Resend Flow

```
Browser
  |
  | POST /auth/resend-signup
  | { email }
  |
  v
Worker: handleResendSignup()
  |
  +-- validateEmailOnly(body)
  |     |-- [FAIL] → 422 VALIDATION_ERROR
  |
  +-- checkRateLimit("resend:<normalized_email>", 3, 86400)
  |     |-- [FAIL] → 429 OTP_RESEND_RATE_LIMITED
  |
  +-- supabaseAuthFetch(env, "/auth/v1/resend", { email, type: "signup" })
        [uses service-role key]
        |-- [FAIL] → 429 RESEND_FAILED
        |-- [OK]   → 200 { success: true, data: null }
```

**Issues found:**
- **SECURITY RISK:** No IP rate limit on resend. Only email-based rate limit. An attacker with many email addresses (or targeting one email from many IPs) can send unlimited resend attempts across email addresses within 3/day per address. IP-based protection would add an additional layer.
- **VERIFIED FACT:** `type: "signup"` is correct for Supabase's resend endpoint per their API documentation.

### 3.3 Password Reset Flow

```
Browser
  |
  | POST /auth/reset-password
  | { email }
  |
  v
Worker: handleResetPassword()
  |
  +-- clientIp(request)
  |
  +-- validateEmailOnly(body)
  |     |-- [FAIL] → 422 VALIDATION_ERROR
  |
  +-- checkRateLimit("reset:<normalized_email>:<ip>", 5, 900)
  |     |-- [FAIL] → 429 RATE_LIMITED
  |
  +-- supabaseAuthFetch(env, "/auth/v1/recover", { email })
        [result ignored — always returns success]
        v
  200 { success: true, data: null }
  (regardless of whether account exists or email sent)
```

**VERIFIED FACT:** Result of the Supabase call is deliberately ignored. This prevents email enumeration — the browser always sees success.

### 3.4 Sign-in

**VERIFIED FACT:** No Worker involvement. Browser calls `supabase.auth.signInWithPassword()` directly. The Worker has no sign-in route.

### 3.5 OTP Verification

**VERIFIED FACT:** No Worker involvement. Browser calls `supabase.auth.verifyOtp()` directly with `type: "email"`.

---

## Section 4 — Order Creation Trace

### Frontend entry point (`CheckoutForm.tsx`)

- **VERIFIED FACT:** User selects a delivery address from their saved addresses (loaded via Supabase client with RLS).
- **VERIFIED FACT:** An idempotency key is generated client-side: `` `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` ``. It is generated once per checkout page mount (if empty).
- **VERIFIED FACT:** `createOrder(selectedAddressId, idempotencyKey)` in `services/worker.ts` fetches the Supabase access token via `supabase.auth.getSession()` and sends it as `Authorization: Bearer <access_token>`.
- **VERIFIED FACT:** The client sends: `{ addressId, idempotencyKey }`. No cart contents, prices, product slugs, or quantities are in the Worker request body.

### Worker entry: `handleCreateOrder()`

```
Browser
  |
  | POST /orders
  | Headers: Authorization: Bearer <supabase_jwt>
  | Body: { addressId, idempotencyKey }
  |
  v
Worker: handleCreateOrder()
  |
  +-- requireAuth(env, request)
  |     |-- verifyUser(): GET /auth/v1/user [service-role apikey, user's JWT as Authorization]
  |     |-- [NULL] → 401 UNAUTHORIZED
  |     |-- [OK]   → { id: user.id, email: user.email }
  |
  +-- clientIp(request) [extracted but used only for rate limit key]
  |
  +-- checkRateLimit("orders:<user.id>", 5, 900)
  |     |-- [FAIL] → 429 RATE_LIMITED
  |
  +-- request.json() → validateOrderRequest(body)
  |     |-- addressId: non-empty string
  |     |-- idempotencyKey: non-empty string, max 100 chars
  |     |-- [FAIL] → 422 VALIDATION_ERROR
  |
  +-- supabaseRestFetch(env, "POST", "/rest/v1/rpc/create_order",
  |       { p_user_id: user.id, p_address_id: addressId, p_idempotency_key: idempotencyKey })
  |     [service-role key — RLS bypassed]
  |
  v
Database RPC: create_order(p_user_id, p_address_id, p_idempotency_key)
  |
  +-- [Step 1] Idempotency check
  |     SELECT id FROM orders WHERE user_id=p_user_id AND idempotency_key=p_idempotency_key
  |     IF found → return { orderId, idempotent: true }
  |
  +-- [Step 2] Address validation
  |     SELECT * FROM addresses WHERE id=p_address_id AND user_id=p_user_id
  |     IF NOT FOUND → return { error: 'ADDRESS_NOT_FOUND' }
  |
  +-- Generate order ID: 'FG-' + year + '-' + random 4-digit number (1000-9999)
  |
  +-- [Step 3] First pass: validate + calculate totals
  |     FOR each cart_item WHERE user_id = p_user_id:
  |       SELECT product WHERE slug = cart_item.product_slug AND is_active = true
  |         IF NOT FOUND → return { error: 'PRODUCT_UNAVAILABLE', slug }
  |         IF availability = 'out-of-stock' → return { error: 'OUT_OF_STOCK', name }
  |       IF variant_id != '':
  |         SELECT variant WHERE product_slug = ? AND variant_id = ?
  |           IF NOT FOUND → return { error: 'VARIANT_UNAVAILABLE', slug }
  |           IF NOT in_stock → return { error: 'VARIANT_OUT_OF_STOCK', name, variant }
  |         unit_price = product.price + variant.price_delta
  |       ELSE:
  |         unit_price = product.price
  |       line_discount = (compare_at - price) * quantity  [if compare_at > price, else 0]
  |       line_total = unit_price * quantity
  |       subtotal += line_total
  |       discount_total += line_discount
  |
  |   IF subtotal = 0 → return { error: 'CART_EMPTY' }
  |
  |   shipping = (subtotal - discount_total >= 4990) ? 0 : 149
  |   total = subtotal - discount_total + shipping
  |
  +-- [Step 4] INSERT INTO orders (with address snapshot, idempotency_key)
  |     EXCEPTION unique_violation ON (user_id, idempotency_key) →
  |       re-query and return { orderId, idempotent: true }
  |
  +-- [Step 5] Second pass: INSERT INTO order_items
  |     FOR each cart_item:
  |       Re-reads product and variant (no availability re-check in second pass)
  |       Inserts: order_id, product_slug, product_name, variant_name,
  |                visual_key, accent, quantity, unit_price, line_discount, line_total
  |
  +-- [Step 6] INSERT INTO order_timeline (5 steps, first marked done)
  |
  +-- [Step 7] DELETE FROM cart_items WHERE user_id = p_user_id
  |
  v
  RETURN { orderId, total }
```

**Back in Worker:**
- If `result.ok = false` (HTTP error from PostgREST) → 500 ORDER_FAILED
- If `result.data.error` (RPC returned an error code) → mapped to user-facing message
- If success → `success(data)` with `{ orderId, total }`

### Explicit answers

1. **User ID derived from verified authentication?** — **YES.** `user.id` comes from `verifyUser()` which calls `/auth/v1/user` with the user's JWT. The client cannot influence which user ID is used. Even though `p_user_id` is passed as an RPC argument, it originates from the Worker's verified JWT decode, not from the request body.

2. **Does the Worker trust client-supplied product prices?** — **NO.** The request body contains only `addressId` and `idempotencyKey`. All prices are read by the RPC from the `products` table.

3. **Does the Worker trust client-supplied order totals?** — **NO.** Totals are computed by the RPC from DB data.

4. **Does the Worker trust product names/images from the client?** — **NO.** `product_name`, `visual_key`, and `accent` are all read from `products` in the second pass of the RPC.

5. **Does the Worker trust stock values from the client?** — **NO.** Stock is read from `products.availability` and `product_variants.in_stock` by the RPC.

6. **Does the Worker validate every product against authoritative DB data?** — **YES, via the RPC.** The first pass validates every cart item against live product and variant records.

7. **Does the Worker validate product availability/active status?** — **YES.** `is_active = true` and `availability != 'out-of-stock'` are checked per item.

8. **Does the Worker validate quantity?** — **PARTIALLY.** The Worker's `validateOrderRequest` does not validate quantity. The RPC reads quantities from `cart_items` (trusted because they were written by the authenticated user under RLS). There is no per-item quantity cap or floor in either the Worker or the RPC.

9. **Minimum and maximum quantities:** — No explicit minimum or maximum. The `cart_items` table has no `CHECK` constraint on `quantity`. If a user inserts `quantity = 0`, `quantity = -5`, or `quantity = 999999` into their cart, the RPC will use it.

10. **Can negative/zero/NaN/fractional/excessive quantities reach the DB?** — **YES.** The cart module (frontend) uses the Supabase client directly with RLS. The RLS policy `cart_items_owner_all` checks `auth.uid() = user_id` but has no quantity constraint. The `cart_items` table has no `CHECK (quantity > 0)` constraint. A user can INSERT `quantity = 0` or `quantity = -1` into their own cart via the Supabase client, and the RPC will multiply it into `line_total = unit_price * quantity`, producing a zero or negative line total. **DATA INTEGRITY RISK.**

11. **Can duplicate products appear in a single order payload?** — The RPC reads from `cart_items` which has `UNIQUE(user_id, product_slug, variant_id)`. Duplicate (slug, variant) pairs per user are prevented at the DB level. **VERIFIED SAFE** for the duplicate product case.

12. **Is the authoritative total calculated server-side?** — **YES.** The RPC calculates `subtotal`, `discount_total`, `shipping_total`, and `total` from DB data.

13. **Are order item prices snapshotted?** — **YES.** `unit_price` and `line_total` are written to `order_items` at order creation time from live product data. Historical snapshots are preserved.

14. **What happens if product price changes during checkout?** — The RPC reads price at execution time. If a price changes between the user loading the checkout page and the RPC executing, the order uses the updated price. The client's displayed price may differ. No price-lock mechanism exists. **BUG/INCONSISTENCY** — no price conflict detection.

15. **What happens if stock changes during checkout?** — The first pass checks `availability` and `in_stock` at execution time. No row lock is held between the check and the order INSERT. See Section 5 for stock race analysis.

16. **Is order creation authenticated?** — **YES.** JWT verified against Supabase Auth via `/auth/v1/user`.

17. **Is order creation rate limited?** — **YES.** 5 requests per 900 seconds per `user.id`.

18. **Rate limit keys:** `orders:<user.id>` (UUID).

19. **Can rate limiting be bypassed by changing request attributes?** — The key uses `user.id` from the verified JWT. The user cannot alter their own UUID. Bypassing would require compromising the JWT or creating multiple accounts.

20. **Can repeated requests create duplicate orders?** — Protected by the `UNIQUE INDEX idx_orders_idempotency ON orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`. The RPC checks for an existing order with the same `(user_id, idempotency_key)` before inserting, and catches `unique_violation` during the INSERT. **Effectively protected against duplicate orders from repeated identical requests.**

21. **Idempotency mechanism?** — **YES.** See above. The idempotency key is generated client-side as `${Date.now()}-${random}`. It is not a UUID. Collision probability is low but non-zero if the clock resolution is coarse. **LOW RISK** in practice.

22. **What happens with concurrent identical requests?** — First INSERT wins; second hits the `unique_violation` catch and returns the existing order ID. **SAFE.**

23. **Can one user create an order for another user?** — **NO.** `p_user_id` is derived from the Worker's JWT verification, not from the request body. The RPC receives the Worker-determined `user.id`. The address validation also enforces `user_id = p_user_id`.

24. **Can one user manipulate another user's cart?** — **NO.** `cart_items` RLS policy: `auth.uid() = user_id`. The RPC reads `cart_items WHERE user_id = p_user_id` using service-role (bypasses RLS), but `p_user_id` comes from the authenticated JWT.

25. **Are DB RLS policies a meaningful protection layer here?** — **PARTIALLY.** The Worker calls the RPC with service-role, bypassing RLS. The RPC itself enforces ownership via `WHERE user_id = p_user_id`. For direct Supabase client calls (cart, profile, addresses), RLS is the primary enforcement layer.

26. **Does the Worker use service-role access?** — **YES.** `supabaseRestFetch` always uses the service-role key. This means the `create_order` RPC is called as service-role, bypassing all RLS policies on `orders`, `order_items`, `cart_items`, etc. The RPC's own WHERE clauses are the substitute validation.

27. **What validation replaces RLS at the service-role boundary?** — The RPC enforces: address ownership (`WHERE user_id = p_user_id`), product existence/activity, variant existence/stock, and cart ownership (`WHERE user_id = p_user_id`). The Worker enforces user identity via JWT verification.

---

## Section 5 — Inventory / Stock Audit

### Where authoritative stock is stored

**VERIFIED FACT:** Stock is represented across two separate mechanisms:

1. **`products.availability`** (`availability_enum`): `in-stock`, `low-stock`, `out-of-stock`, `preorder`. A boolean-style categorical flag. The RPC checks this at order time.
2. **`products.stock`** (`integer, nullable`): A raw integer count column. It is `nullable` (no NOT NULL constraint). No `CHECK (stock >= 0)` constraint exists.
3. **`product_variants.in_stock`** (`boolean, NOT NULL, DEFAULT true`): Per-variant binary stock flag.

**VERIFIED FACT:** There is no numeric stock counter for variants. Variant stock is binary (`in_stock` boolean only).

### Does stock get deducted at order creation?

**VERIFIED FACT: NO.** The `create_order` RPC does not UPDATE `products.stock`, `products.availability`, or `product_variants.in_stock` at any step. The RPC only reads these values — it does not mutate them.

**The complete stock mutation map: NOTHING deducts stock.** No trigger, function, or RPC mutates stock on order creation, confirmation, shipping, or delivery. The `products.stock` integer column and the `products.availability` enum exist and are checked during order creation, but are never decremented by any automated process.

### Stock check and mutation map

| Operation | Tables Read | Tables Written | Atomicity | Stock Mutated? |
|-----------|-------------|---------------|-----------|----------------|
| `create_order` RPC | `products`, `product_variants`, `cart_items`, `addresses` | `orders`, `order_items`, `order_timeline`, `cart_items` (DELETE) | Within RPC transaction | **NO** |
| Direct cart write (browser) | None for stock | `cart_items` | Per-statement | No |
| Profile update (browser) | None for stock | `profiles` | Per-statement | No |

**No triggers on `orders` mutate `products.stock`** — verified from the trigger list. The only relevant business trigger is `on_auth_user_created` on `auth.users` (creates profiles). No `orders` trigger touches stock.

### Explicit answers

1. **Authoritative stock stored where?** `products.availability` (categorical), `products.stock` (integer, not enforced), `product_variants.in_stock` (boolean per variant).

2. **Stock in one table or scattered?** — **SCATTERED across two tables with two different representation models** (`availability_enum` vs `integer` vs `boolean`). These are not kept in sync automatically.

3. **Which DB objects can mutate stock?** — No automated DB object currently mutates stock. Only manual admin updates to `products.availability`, `products.stock`, or `product_variants.in_stock` change inventory state.

4. **Is stock deducted at all?** — **NO.** Stock is never decremented by any automated process.

5. **Exact reason from implementation:** The `create_order` RPC (lines confirmed from DB) does not contain any UPDATE statement targeting `products` or `product_variants`. No trigger on `orders` or `order_items` updates stock. This is a missing implementation — not an architectural decision documented anywhere.

6. **Is stock checked before order creation?** — **YES.** The RPC first-pass validates `availability != 'out-of-stock'` for products and `in_stock = true` for variants.

7. **Is stock check and stock mutation atomic?** — **N/A** — mutation does not exist, so there is no atomicity to verify.

8. **SELECT → check → later UPDATE race?** — **RACE CONDITION POSSIBLE** for any scenario where two concurrent requests both read the same product as in-stock before either one would decrement (if decrement existed). Since decrement never happens, overselling is guaranteed once any product is approaching zero real-world inventory — the system has no way to detect or prevent it.

9. **Can two concurrent requests purchase the final unit?** — **YES.** Both pass the `availability` check, both orders are created, stock is never decremented. **CRITICAL DATA INTEGRITY RISK.**

10. **Can stock become negative?** — `products.stock` has no `CHECK (stock >= 0)` constraint. If stock were ever decremented, it could go negative. Currently moot since no decrement exists.

11. **Can an order be created without stock being deducted/reserved?** — **YES — always.** Every order is created without any stock reservation or deduction.

12. **Can stock be deducted if order creation fails?** — Not applicable; deduction never occurs.

13. **Can stock be deducted twice?** — Not applicable; deduction never occurs.

14. **What happens when an order is cancelled?** — The order status can be set to `cancelled` (enum value exists). No trigger or function restores stock on cancellation. The `products.availability` flag and `products.stock` column remain unchanged.

15. **What happens when an order fails?** — If the RPC returns an error before the INSERT, no order row is created. If the order is created but payment fails (future concern — COD is currently the only method so payment is always `pending`), the order stays in `processing` status. No stock is affected either way.

16. **Is stock restored anywhere?** — **NO.** No automatic stock restoration on cancellation, failure, or return exists.

17. **Are there triggers mutating stock outside the Worker?** — **NO triggers mutate stock.** Verified from the complete trigger list retrieved from the live database.

18. **Are there RPCs duplicating stock logic?** — No other RPC touches stock beyond `create_order`'s read-only check.

19. **More than one source of truth for inventory?** — **YES: two inconsistent representations.** `products.availability` (categorical, checked at order time) and `products.stock` (integer, nullable, never decremented, effectively decorative). These can diverge and there is no enforcement between them.

### Concurrency assessment

| Scenario | Status |
|----------|--------|
| Two concurrent orders for the same out-of-stock product | SAFE — both blocked by availability check |
| Two concurrent orders for the same in-stock product | RACE CONDITION POSSIBLE — both succeed, stock never decremented |
| Order creation for product with stock=1 | RACE CONDITION POSSIBLE — both orders succeed, real stock exhausted, no system record |
| Idempotent re-submission of same order | SAFE — unique_violation catch |

---

## Section 6 — Database Object Inventory

### Tables

#### `products`

- **PK:** `slug` (text) — slug is the primary identifier throughout
- **Additional unique keys:** `ux_products_id` (uuid), `ux_products_fgp_number` (text)
- **Stock columns:** `availability` (`availability_enum`), `stock` (`integer, nullable`)
- **`stock` column:** No NOT NULL constraint, no CHECK constraint. Currently nullable.
- **RLS:** Enabled. Policy: `products_public_read` (SELECT = true for all). No write policy for public.
- **Grants:** `anon`, `authenticated`, `service_role` all have full privileges (INSERT/UPDATE/DELETE/etc.). RLS restricts `anon`/`authenticated` to SELECT only in practice.
- **`is_active`:** Boolean flag, default true. Checked in `create_order` first pass.

#### `product_variants`

- **PK:** `id` (bigint)
- **Unique:** `(product_slug, variant_id)`
- **Stock:** `in_stock` boolean, NOT NULL, DEFAULT true
- **No numeric stock count for variants**
- **RLS:** Enabled. Policy: `product_variants_read` (SELECT = true). No write policy.

#### `cart_items`

- **PK:** `id` (uuid)
- **Unique:** `(user_id, product_slug, variant_id)` — prevents duplicate cart entries
- **`quantity`:** integer, NOT NULL, **no CHECK constraint** — can be zero, negative, or arbitrarily large
- **FK:** `user_id → profiles(id) ON DELETE CASCADE`, `product_slug → products(slug) ON DELETE CASCADE`
- **RLS:** Enabled. Policy: `cart_items_owner_all` (ALL operations where `auth.uid() = user_id`)
- **BUG:** No quantity validation at the database level. Browser and RLS enforce ownership but not validity.

#### `orders`

- **PK:** `id` (text, format "FG-YYYY-NNNN")
- **Unique indexes:** `orders_pkey`, `idx_orders_idempotency` ON `(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
- **`idempotency_key`:** nullable text, max 100 chars
- **`status`:** `order_status_enum`, default `processing`
- **`payment_status`:** `payment_status_enum`, default `pending`
- **`payment_method`:** `payment_method_enum`, default `cod`
- **Address snapshot:** `ship_label`, `ship_line1`, `ship_line2`, `ship_city`, `ship_state`, `ship_postcode`, `ship_country`, `ship_phone` — full address snapshot at order time. Correct design.
- **Financial columns:** `subtotal`, `discount_total`, `shipping_total`, `tax_total`, `total` — all integer (whole rupees). `tax_total` defaults to 0 with no tax calculation logic.
- **FK:** `user_id → profiles(id) ON DELETE RESTRICT`
- **RLS:** Enabled. Policy: `orders_owner_read` (SELECT where `user_id = auth.uid()`). No INSERT/UPDATE/DELETE policies for public — orders can only be created via service-role (Worker RPC).
- **INCONSISTENCY:** `orders` order ID is `'FG-' + year + '-' + random(1000-9999)`. This is 3600 possible values per year before collision becomes a concern. With 9000 possible values per year and no uniqueness guarantee in the generation logic (only `orders_pkey` uniqueness constraint catches a collision after the fact), the RPC will fail on a primary key collision without handling it. **LOW RISK** at current scale but not collision-safe.

#### `order_items`

- **PK:** `id` (bigint, GENERATED ALWAYS AS IDENTITY)
- **Unique:** `(order_id, product_slug, variant_name)` — prevents duplicate items per order
- **`product_slug` FK:** `ON DELETE SET NULL` — if a product is deleted, the historical reference is nulled, preserving the order record with the snapshotted name/price.
- **No INSERT/UPDATE policies** — only `order_items_owner_read` (SELECT). Created via service-role through the RPC.

#### `order_timeline`

- **PK:** `id` (bigint)
- **5 timeline steps created at order time.** `step_date` is NULL for future steps.
- **No write policies.** Only readable by order owner.

#### `profiles`

- **PK:** `id` (uuid, FK → auth.users ON DELETE CASCADE)
- **`onboarding_state`:** `onboarding_state_enum` — `incomplete`, `address_optional`, `complete`
- **RLS:** `profiles_self_read`, `profiles_self_update` — owner only.
- **No INSERT policy** — profiles are created only by the `handle_new_auth_user` trigger.

#### `addresses`

- **Unique index:** `idx_addresses_default_per_user` ON `(user_id) WHERE is_default` — enforces at most one default address per user.
- **RLS:** `addresses_owner_all` — full owner control.

#### `signup_authorizations`

- **Partial unique index:** `ux_signup_auth_token_hash_unconsumed` ON `(token_hash) WHERE consumed_at IS NULL` — prevents two unconsumed rows with the same token hash.
- **RLS:** Enabled but **no policies defined for anon/authenticated**. The table has full grants to `anon`, `authenticated`, `service_role` at the Postgres level, but RLS with no matching policy means anon/authenticated are denied by default. Service-role bypasses RLS and can INSERT. This is the correct configuration.
- **SECURITY RISK (low, mitigated by design):** `anon` and `authenticated` have Postgres-level table grants but no RLS policies, so their access is effectively blocked. However, service-role bypasses RLS. The Worker uses service-role for INSERTs. This is correct by design — the service-role key is secret and never in the browser.

#### `worker_rate_limits`

- **Columns:** `key` (text), `created_at` (timestamptz, DEFAULT now())
- **Index:** `idx_rate_limits_key_time` ON `(key, created_at)` — supports the windowed delete+count in `check_rate_limit`.
- **No primary key.** Multiple rows per key are expected (one per request within the window).
- **RLS:** Enabled. No policies for anon/authenticated (blocked by default). Service-role bypasses for the RPC.
- **`check_rate_limit` RPC:** SECURITY DEFINER. Called by the Worker via service-role. Callable by `anon`, `authenticated`, `service_role`. **SECURITY RISK:** The `check_rate_limit` function is callable directly by `anon` and `authenticated` roles. An authenticated browser user could call `POST /rest/v1/rpc/check_rate_limit` with arbitrary `p_key` values, poisoning the rate limit store or causing legitimate keys to be counted against. The Worker's service-role usage is correct, but the function's direct callability from the browser is a gap.

### Functions / RPCs

#### `create_order(p_user_id uuid, p_address_id uuid, p_idempotency_key text)`

- **SECURITY DEFINER:** YES
- **Return type:** `jsonb`
- **Permissions:** Callable by `anon`, `authenticated`, `service_role`
- **SECURITY RISK:** `create_order` is callable directly by `anon` and `authenticated` via the Supabase REST API at `POST /rest/v1/rpc/create_order`. A logged-in user can call this directly with any `p_user_id`, `p_address_id`, and `p_idempotency_key`, bypassing the Worker entirely. The RPC validates `WHERE user_id = p_user_id` for addresses and reads cart items for the same `p_user_id`, but since the function accepts `p_user_id` as a parameter, an authenticated user could pass any UUID as `p_user_id` and attempt to create an order for another user's cart if they know that user's UUID. The address validation `WHERE id = p_address_id AND user_id = p_user_id` prevents using another user's address if `p_user_id` is mismatched, but they could pass their own UUID. The practical impact: if a user calls the RPC directly with their own `p_user_id`, it bypasses the Worker's rate limiting and Turnstile/auth checks. No registration authorization bypass is possible here (registration is separate), but order rate limiting can be bypassed by calling the RPC directly.
- **Transaction behavior:** The entire function runs in a single transaction. A failure after the orders INSERT will roll back orders and order_items. However, the `EXCEPTION WHEN unique_violation` handler inside the function commits the exception handling block — this is a subtransaction (savepoint) in PostgreSQL's exception handling, which means the outer transaction continues. This is correct PL/pgSQL behavior.

#### `check_rate_limit(p_key text, p_max integer, p_window_seconds integer)`

- **SECURITY DEFINER:** YES
- **Callable by:** `anon`, `authenticated`, `service_role`
- **Logic:** DELETE expired entries for key, INSERT new entry, SELECT count <= max.
- **RACE CONDITION:** The DELETE + INSERT + SELECT are three separate statements within the function. In PostgreSQL, a `SECURITY DEFINER` function does not implicitly wrap its body in a transaction unless the caller has one. Since the function is called via PostgREST RPC (auto-committed), all three statements run in the same transaction (PostgREST wraps each RPC call in a transaction). However, two concurrent calls with the same key could both DELETE expired entries, both INSERT, and both read a count that does not reflect the other's INSERT yet. The INSERT happens before the SELECT in the same transaction, so within one call the count is accurate. Between concurrent calls, there is a brief window where both could see a count of `n` when the real count is `n+1`. This is a **soft race condition** — it means the rate limit can be exceeded by at most `concurrency - 1` requests in the worst case. Not a hard security vulnerability for the use cases here (registration, orders) but worth noting.
- **Behavior when unavailable:** `checkRateLimit` calls `supabaseRestFetch`. If Supabase is unreachable, the fetch fails, `result.ok` is false, `result.data !== true`, so `checkRateLimit` returns `false` (rate-limited). All protected endpoints fail closed. This is a safe default.

#### `consume_signup_authorization(p_email_hash text, p_token_hash text)`

- **SECURITY DEFINER:** YES
- **Callable by:** `service_role`, `supabase_auth_admin` only — not by anon or authenticated.
- **Atomic:** YES. Single `UPDATE ... WHERE ... AND consumed_at IS NULL RETURNING *`.

#### `hook_validate_signup_authorization(event jsonb)`

- **SECURITY DEFINER:** YES
- **Callable by:** `service_role`, `supabase_auth_admin` only.
- **Called by:** Supabase Auth "Before User Created" hook.
- **Fail-closed:** YES. Missing token → reject. Invalid/expired/consumed token → reject.

#### `handle_new_auth_user()`

- **SECURITY DEFINER:** YES — required to INSERT into `profiles` from the `auth.users` trigger context.
- **Called by:** Trigger `on_auth_user_created` AFTER INSERT on `auth.users`.
- **Logic:** `INSERT INTO profiles (id, email) ... ON CONFLICT (id) DO NOTHING`.
- **`ON CONFLICT DO NOTHING`:** Idempotent. Will not fail if a profile already exists.

#### `can_review_product(p_product_id uuid)`

- **SECURITY INVOKER** (prosecdef = false).
- **Called by:** RLS policy `product_reviews_owner_insert`.
- **Logic:** EXISTS check — user has a delivered order containing the product slug.

#### `set_updated_at()` and `touch_updated_at()`

- **Duplicate functions.** `set_updated_at` and `touch_updated_at` do the same thing: `NEW.updated_at = now(); RETURN NEW;`. Both are used as `BEFORE UPDATE` triggers on different tables. **POSSIBLE REDUNDANCY** — these should be consolidated but are not harmful as-is.

### Triggers

| Trigger | Table | Event | Function | Purpose |
|---------|-------|-------|----------|---------|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_auth_user` | Creates profile row |
| `trg_orders_updated_at` | `orders` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |
| `trg_profiles_updated_at` | `profiles` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |
| `trg_products_updated_at` | `products` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |
| `trg_cart_items_updated_at` | `cart_items` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |
| `trg_addresses_updated_at` | `addresses` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |
| `trg_brands_updated_at` | `brands` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |
| `trg_categories_updated_at` | `categories` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |
| `trg_offers_updated_at` | `offers` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |
| `trg_product_reviews_updated_at` | `product_reviews` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |
| `trg_product_variants_updated_at` | `product_variants` | BEFORE UPDATE | `set_updated_at` | Updates `updated_at` |

**No triggers on `orders`, `order_items`, or `products` mutate stock.** Verified.

---

## Section 7 — Order Status Lifecycle

### Actual status values (from `order_status_enum`)

**VERIFIED FACT:** The enum contains exactly: `processing`, `confirmed`, `shipped`, `out-for-delivery`, `delivered`, `cancelled`, `returned`.

### Initial state on order creation

**VERIFIED FACT:** The `create_order` RPC always inserts: `status = 'processing'`, `payment_status = 'pending'`, `payment_method = 'cod'`.

### Who can transition each status?

- **VERIFIED FACT:** No code in the Worker updates order status. The Worker only creates orders.
- **VERIFIED FACT:** The frontend reads order status (via RLS SELECT policy on `orders`) but the `orders_owner_read` policy is SELECT only — no INSERT/UPDATE/DELETE for authenticated users.
- **VERIFIED FACT:** No RPC or function exists that transitions order status.
- **UNVERIFIED:** Status transitions are presumably done by an admin or backend process not visible in this codebase. No such code was found in the audited files.

### Are illegal transitions validated?

**NO.** There is no constraint, trigger, or function that enforces a valid status transition path. An admin (service-role) could directly UPDATE an order from `processing` to `delivered` or `returned` without passing through intermediate states.

### Payment status lifecycle

Payment statuses: `pending`, `paid`, `failed`, `refunded`.  
All orders start `pending`. Since COD is the only method, `paid` would be set externally when cash is collected. No automation exists for this in the current codebase.

### Timeline lifecycle

Five fixed steps are inserted at order creation:
1. `Order placed` (done=true, step_date=now())
2. `Packed` (done=false, step_date=NULL)
3. `Shipped` (done=false, step_date=NULL)
4. `Out for delivery` (done=false, step_date=NULL)
5. `Delivered` (done=false, step_date=NULL)

No code updates these timeline entries. They remain as created unless manually updated.

### Does "successful order" have a precise meaning?

**VERIFIED FACT:** A successful order creation means:
- A row exists in `orders` with `status = 'processing'`
- Order items are snapshotted in `order_items`
- Timeline steps are inserted
- The user's cart is cleared

There is no automatic transition to `confirmed`, no payment gate, no stock deduction, and no "completion" signal. An order in `processing` is the end state from the system's perspective. It is not explicitly "successful" beyond existing as a record.

---

## Section 8 — Error Handling and Response Contract

### Centralized contract

**VERIFIED FACT:** `response.ts` defines the canonical shape:
- Success: `{ success: true, data: any }`
- Error: `{ success: false, error: { code: string, title: string } }`
- HTTP status is set independently (not always derivable from `success`).

### Frontend mapping (`lib/auth-errors.ts`)

**VERIFIED FACT:** `resolveWorkerError(err)` maps known `AuthErrorCode` strings to canonical titles. If the code is not in the map, it falls back to `err.title` from the response, then to `"Something went wrong"`.

### Order errors (`orders.service.ts`)

**INCONSISTENCY:** The order service uses a local `errMap` object inline, separate from `lib/auth-errors.ts`. Order error codes (`ADDRESS_NOT_FOUND`, `CART_EMPTY`, `PRODUCT_UNAVAILABLE`, etc.) are not in `AuthErrorCode`. These codes are mapped to messages in `orders.service.ts` but the frontend receives only the `error.title` via `resolveWorkerError`. The order codes pass through because `resolveWorkerError` falls back to `err.title` for unknown codes. This works but means order error codes are not covered by the centralized `auth-errors.ts` type.

### Does the resend OTP 429 correctly surface?

**VERIFIED FACT (corrected):** The Worker now returns `OTP_RESEND_RATE_LIMITED` for the resend 429. `auth-errors.ts` maps this to `"Too many verification requests"`. `resolveWorkerError` finds the code in `ERROR_TITLES` and returns the canonical title. The 429 title is now preserved correctly through the chain.

### Raw error leakage risks

- **`console.error` in `auth.service.ts`:** Two `console.error` calls log internal Worker state. These appear in Cloudflare dashboard logs only — not sent to the browser. Safe.
- **`auth.service.ts` Supabase error message extraction:** The `msg` variable is read from `signup.body.msg` or `signup.body.message` and used only for pattern matching, never forwarded to the browser. The browser always receives a canonical `title` string.
- **`orders.service.ts` pass-through:** The RPC returns `{ error: 'CODE', ... }` as a 200 OK. The Worker maps these codes to messages via `errMap`. If `errCode` is not in `errMap`, it falls back to `{ code: "ORDER_FAILED", message: "Unable to create order." }`. The raw RPC error code is never sent to the browser.

### HTTP status codes

| Scenario | Status Used | Correct? |
|----------|-------------|---------|
| Rate limited | 429 | Yes |
| Turnstile failed | 422 | Acceptable (Unprocessable Entity) |
| Validation error | 422 (default) | Yes |
| Email exists | 409 | Yes |
| Unauthorized | 401 | Yes |
| RPC failure | 500 | Yes |
| Resend/recovery fail | 429 | Questionable — 429 for a backend failure (not rate limit) |

**INCONSISTENCY:** `handleResendSignup` returns 429 when the Supabase resend call fails (`!result.ok`). The 429 status implies rate limiting, but the actual cause here is a Supabase API failure. The correct status for an upstream service failure would be 502 or 500. This is a minor inconsistency — the `title` shown to the user ("Unable to resend code") is correct.

---

## Section 9 — Rate Limit Audit

### Implementation

**VERIFIED FACT:** Rate limiting is backed by the `check_rate_limit` Supabase RPC and `worker_rate_limits` table. The RPC is SECURITY DEFINER. The Worker calls it via `supabaseRestFetch` with the service-role key.

### Per-endpoint audit

| Endpoint | Key | Limit | Window | Storage | Notes |
|----------|-----|-------|--------|---------|-------|
| `POST /auth/register` (IP) | `register:<ip>` | 5 | 900s | `worker_rate_limits` | Checked before email limit |
| `POST /auth/register` (email) | `register:<normalized_email>` | 3 | 900s | `worker_rate_limits` | Normalized email only |
| `POST /auth/resend-signup` | `resend:<normalized_email>` | 3 | 86400s | `worker_rate_limits` | 3/day per email. No IP limit. |
| `POST /auth/reset-password` | `reset:<normalized_email>:<ip>` | 5 | 900s | `worker_rate_limits` | Combined email+IP key |
| `POST /orders` | `orders:<user.id>` | 5 | 900s | `worker_rate_limits` | User UUID from verified JWT |

### Storage mechanism

**VERIFIED FACT:** `worker_rate_limits` table. Rows are inserted per request; `check_rate_limit` deletes expired entries for the key, inserts a new entry, then counts current entries within the window. Persistent across Worker instances and restarts.

### Atomicity

**VERIFIED FACT:** The `check_rate_limit` function runs within a PostgREST auto-committed transaction. The three statements (DELETE, INSERT, SELECT) are in the same transaction. A soft race exists for concurrent calls (see Section 6).

### Multiple Worker instances

**VERIFIED FACT:** Because the rate limit is backed by Supabase (a shared database), all Worker instances share the same counter. This is correct for a horizontally scaled deployment.

### Behavior when storage is unavailable

**VERIFIED FACT:** `checkRateLimit` returns `false` (blocked) when `supabaseRestFetch` fails. All rate-limited endpoints fail closed during a Supabase outage. This is safe but causes service disruption.

### Bypass possibilities

- **IP bypass:** A user can cycle IPs to bypass the IP-based register limit. The email-based limit provides a second layer specifically for this case.
- **Email bypass (registration):** A user could use many email addresses. However, each registration requires a Turnstile challenge, and each email address goes through the Before User Created Hook. This is acceptable.
- **Direct RPC call (orders):** An authenticated user calling `create_order` directly bypasses the `orders:<user.id>` rate limit. See Section 6.
- **`check_rate_limit` direct call:** An `anon` or `authenticated` user can call `check_rate_limit` directly via the Supabase REST API to insert arbitrary keys into `worker_rate_limits` or to exhaust the table. The RPC only INSERTs and DELETEs within the key's window, so inserting fake keys creates garbage rows but does not affect legitimate keys. **LOW RISK** but a hardening opportunity.

### Appropriateness of limits

- **Registration:** 5/15min per IP + 3/15min per email — reasonable for registration abuse prevention.
- **OTP resend:** 3/day per email — appropriate, prevents OTP flooding.
- **Password reset:** 5/15min combined email+IP — appropriate.
- **Order creation:** 5/15min per user — appropriate for legitimate checkout scenarios.

---

## Section 10 — Trust Boundary Map

### 1. Registration boundary

```
[Browser]
  Trust: NONE for security decisions.
  Provides: email, password, Turnstile widget token.
  Cannot: trigger signup without Worker authorization.
  Cannot: bypass hook by forging metadata.

[Cloudflare Turnstile]
  Trust: Response from Cloudflare siteverify is trusted.
  Validates: challenge completed by a human.
  Single-use: tokens consumed on Worker verify; cannot be replayed.

[Worker /auth/register]
  Authority: Registration gate, Turnstile verifier, authorization issuer.
  Trusts: Its own env secrets (Supabase keys, Turnstile secret).
  Validates: Input format, IP + email rate limits, Turnstile (server-side).
  Produces: One-time token, stores only hash.
  Never returns: Raw token to browser.

[Supabase Auth /auth/v1/signup]
  Trust boundary: Receives the signup request with anon key.
  Hook fires: Before user is created.
  Cannot be bypassed without a valid, unexpired, unconsumed authorization token.

[Before User Created Hook (DB function)]
  Authority: Final hard enforcement. Fail-closed.
  Validates: Authorization hash matches email hash, not expired, not consumed.
  Atomically consumes: authorization on success.

[Supabase DB]
  Authority: Source of truth for authorizations, profiles, rate limits.
  Service-role bypass: Used by Worker for INSERT into signup_authorizations.
```

### 2. OTP Resend boundary

```
[Browser] → [Worker /auth/resend-signup] → [Supabase /auth/v1/resend]
  Worker validates: email format, rate limit (email/day).
  No authentication required. Any caller can resend for any email.
  Risk: No IP limit. Mitigated by 3/day per email.
```

### 3. Password/Account Recovery boundary

```
[Browser] → [Worker /auth/reset-password] → [Supabase /auth/v1/recover]
  Worker validates: email format, rate limit (email+IP).
  No authentication required. Result never discloses account existence.
```

### 4. Order Creation boundary

```
[Browser]
  Provides: JWT access token, addressId, idempotencyKey.
  Cannot: Influence prices, product names, quantities (cart is owned by RLS).
  Cannot: Bypass Worker without calling /orders directly.

[Worker /orders]
  Verifies: JWT via /auth/v1/user (service-role + user's JWT).
  Rate limits: 5/15min per user.id.
  Passes to DB: user.id (verified), addressId, idempotencyKey.
  Does NOT pass: cart contents, prices, quantities.

[Supabase create_order RPC (service-role)]
  Reads: cart_items for the verified user.id.
  Reads: products, product_variants for prices, availability.
  Reads: addresses, validates ownership.
  Writes: orders, order_items, order_timeline (all).
  Clears: cart_items for the user.

BYPASS RISK: create_order is callable directly by authenticated users.
  An authenticated user can call it without the Worker, bypassing rate limits.
```

### 5. Inventory mutation boundary

```
No automated inventory mutation exists.
Inventory is read at order time (availability check) but never decremented.
Only manual admin actions can change products.availability, products.stock,
or product_variants.in_stock.
```

---

## Section 11 — Redundancy and Stale Code Audit

### SAFE TO REMOVE

#### `src/dev.ts`

- **Evidence:** Not referenced in any npm script. Not imported by any source file. Not wrangler's entry point. Only callable via `bun run src/dev.ts` manually.
- **Risk of removal:** None. `wrangler dev` is the documented dev workflow.

#### `normalizeEmail()` in `src/lib/signup-auth.ts`

- **Evidence:** Identical implementation to `normalizeEmail()` in `src/lib/validation.ts`. The auth service calls `validateRegistration()` (which normalizes via `validation.ts`), then passes the result to `emailHash()` (which normalizes again via `signup-auth.ts`). Double normalization is harmless.
- **Risk of removal:** Low. The caller would need to use `validation.ts`'s version or accept a pre-normalized email.
- **Requires refactor before deletion:** Yes — `emailHash()` would need to accept a pre-normalized email, or `signup-auth.ts` should import from `validation.ts`.

### REQUIRES REFACTOR BEFORE REMOVAL

#### `src/middleware/auth.ts`

- **Evidence:** A one-line wrapper (`return verifyUser(env, request)`). Adds no middleware behavior.
- **Dependency:** `orders.service.ts` imports `requireAuth` from `./middleware/auth`. Changing this requires updating the service import.
- **Risk:** Low, purely mechanical change.

#### `src/lib/validation.ts` → `validateOrderRequest` does not validate quantity

- **This is not redundant code — it is missing validation.** The order request currently only validates `addressId` and `idempotencyKey`. Quantity validation lives nowhere. This is a gap, not redundancy.

#### `touch_updated_at()` function

- **Evidence:** Duplicate of `set_updated_at()`. Both return `NEW.updated_at = now(); RETURN NEW;`.
- **Dependency:** Must check which triggers use which. From the trigger list: all `trg_*_updated_at` triggers use `set_updated_at`. `touch_updated_at` exists in `pg_proc` but was not found in any trigger's function name in the retrieved trigger list.
- **POSSIBLE REDUNDANCY:** `touch_updated_at` may be unused by any trigger. Requires confirming no trigger calls it before removal.

### MUST KEEP

#### IP + Email rate limits on registration (both layers)

- **Purpose:** IP rate limit prevents a single machine from mass-registering. Email rate limit prevents using one email address repeatedly (e.g., from rotating IPs). The two layers serve different attack vectors. Removing either reduces the security model without improving it.

#### Before User Created Hook + signup_authorizations

- **Purpose:** Prevents anyone from calling `POST /auth/v1/signup` directly (bypassing the Worker) to create accounts. The hook is the final enforcement layer against Worker bypass. The authorization table is the cryptographic proof of Worker involvement.
- **Removing either would allow direct browser signup.** This would undermine the entire registration security architecture.

#### Atomic `UPDATE ... WHERE consumed_at IS NULL RETURNING *` in `consume_signup_authorization`

- **Purpose:** Prevents two concurrent processes from consuming the same authorization. Replacing with SELECT + check + UPDATE would introduce a time-of-check/time-of-use race.

#### `supabaseSignup` uses anon key (not service-role)

- **Purpose:** Using anon key causes Supabase to apply the normal user confirmation flow and fire the Before User Created Hook. Using service-role (`admin.createUser()`) would bypass the hook. This is a critical architectural requirement, not an oversight.

#### `verifyUser()` calling `/auth/v1/user` with the user's JWT

- **Purpose:** This is the correct way to validate a JWT without exposing the service-role key to the client. The `/auth/v1/user` endpoint validates the token's signature and expiry. This is not redundant — it is the identity verification step.

#### Separate `signup_authorizations` table with hash-only storage

- **Purpose:** Storing only hashes means even if an attacker reads the table (e.g., via a SQL injection elsewhere), they cannot reconstruct or replay authorization tokens. The raw token exists only transiently in Worker memory and in Supabase's in-flight signup request.

---

## Section 12 — Findings Priority Table

| Priority | Area | Finding | Classification | Evidence | Impact | Affected Flow |
|----------|------|---------|---------------|----------|--------|---------------|
| CRITICAL | Inventory | No stock decrement on order creation. Unlimited overselling possible. | DATA INTEGRITY RISK | `create_order` RPC has no UPDATE on `products.stock` or `availability`. No trigger deducts stock. | Every order succeeds regardless of actual physical inventory. Unlimited units can be sold. | All order creation |
| CRITICAL | Cart | `cart_items.quantity` has no CHECK constraint. Zero, negative, and extreme quantities are stored and used. | DATA INTEGRITY RISK | `cart_items` table schema: `quantity integer NOT NULL` with no CHECK. No validation in Worker or RPC. | Negative quantities produce negative line totals. Orders can have ₹0 or negative totals. | Cart, order creation |
| HIGH | Security | `create_order` RPC callable directly by `authenticated` users, bypassing Worker rate limiting. | SECURITY RISK | `routine_privileges` shows `authenticated` has EXECUTE on `create_order`. Worker rate limit uses `orders:<user.id>` but is skipped for direct RPC calls. | Order rate limiting can be bypassed. 5/900s limit ineffective for determined attacker. | Order creation |
| HIGH | Security | `check_rate_limit` RPC callable directly by `anon` and `authenticated`. | SECURITY RISK | `routine_privileges` shows `anon` and `authenticated` have EXECUTE. | Rate limit store can be polluted with fake keys. Legitimate keys could be poisoned if an attacker knows the key format. | All rate-limited endpoints |
| HIGH | Inventory | `products.stock` integer column: nullable, no CHECK constraint, never decremented, not kept in sync with `products.availability`. | DATA INTEGRITY RISK | Column definition: `nullable, no constraints`. `create_order` RPC reads `availability` but never reads or writes `stock`. | Two inconsistent stock representations. `stock` column is effectively decorative. | Inventory management |
| HIGH | Security | Hardcoded service-role key and Turnstile secret in `env.ts` as plaintext fallback defaults. | SECURITY RISK | `env.ts` source code shows both keys as string literals. The Supabase project is live. | If deployed without wrangler secrets set, live credentials ship in the deployed bundle's fallback code. | All Worker operations |
| MEDIUM | Race condition | Concurrent orders for the same in-stock product can both succeed. No stock lock exists. | RACE CONDITION | No FOR UPDATE or advisory lock in `create_order`. Availability check and order INSERT are not atomic with respect to concurrent orders. | Two users can simultaneously purchase the last unit. | Order creation |
| MEDIUM | Order ID | Order ID generation (`FG-YYYY-1000–9999`) provides only 9000 unique values per year. Collision on primary key causes RPC failure. | BUG | `create_order` generates `floor(random() * 9000) + 1000`. No retry on PK collision. | At ~4500+ orders/year, ~50% collision probability. RPC fails on collision without graceful handling. | Order creation |
| MEDIUM | Security | `supabaseRestFetch` has no timeout. Can hang indefinitely. | BUG | Function body has no `AbortController`. `supabaseSignup` and `supabaseAuthFetch` both have 10s timeouts. | Worker execution can hang on slow DB responses for: authorization INSERT, RPC calls, rate limit calls. | Registration, order creation |
| MEDIUM | Trust | Price displayed to user at checkout is computed frontend-side from cart state. If product price changes between page load and order submission, user sees old price but pays new price. | INCONSISTENCY | `CheckoutForm` displays price from `useCartContext()` (in-memory). RPC computes from live DB. No price-mismatch detection or user notification. | Silent price discrepancy possible. Not a security risk (price is authoritative server-side) but a UX/trust issue. | Checkout |
| MEDIUM | Resend OTP | No IP rate limit on `/auth/resend-signup`. Only email-based limit (3/day). | INCONSISTENCY | `handleResendSignup` calls `checkRateLimit` with `resend:<email>` key only. No IP component. | Attacker can enumerate valid emails for resend from many IPs without IP-level restriction. | OTP resend |
| MEDIUM | HTTP Status | `handleResendSignup` returns 429 when Supabase call fails (not rate limit). | INCONSISTENCY | `if (!result.ok) return fail("RESEND_FAILED", ..., 429)`. 429 implies rate limit; actual cause is upstream failure. | Client receives incorrect HTTP status. Title is correct ("Unable to resend code"). | OTP resend |
| LOW | Structural | `normalizeEmail()` duplicated in `validation.ts` and `signup-auth.ts`. | REDUNDANCY | Both files define identical `email.trim().toLowerCase()`. Double normalization applied in `handleRegister`. | Harmless. Idempotent double normalization. Cleanup opportunity only. | Registration |
| LOW | Structural | `src/middleware/auth.ts` is a one-line pass-through with no added value. | STRUCTURAL PROBLEM | File contains only `return verifyUser(env, request)`. Provides no middleware behavior. | Unnecessary abstraction layer. Cleanup opportunity only. | Order creation |
| LOW | Structural | `set_updated_at` and `touch_updated_at` are duplicate DB functions. | REDUNDANCY | Both functions have identical body. `touch_updated_at` appears unused by any trigger in the retrieved list. | No functional impact. Cleanup opportunity. | Schema maintenance |
| LOW | Structural | `dev.ts` not referenced in any npm script or imported file. | REDUNDANCY | `package.json` scripts only reference `wrangler dev`. `dev.ts` is a dead file. | No functional impact. | Development tooling |
| LOW | Structural | Order service error codes not in `lib/auth-errors.ts`. | INCONSISTENCY | `orders.service.ts` uses an inline `errMap`. Order codes are not part of the `AuthErrorCode` type. | Error codes work (fall through `resolveWorkerError`'s `err.title` path) but are not in the centralized contract. | Order error handling |

---

## Section 13 — Recommended Rewrite Boundaries

This section defines logical boundaries for the next implementation phase. No code is proposed here.

### 1. Worker responsibilities that should be separated

The current `auth.service.ts` handles three distinct business domains in one file:
- **Account creation (registration):** Has complex security logic (Turnstile, rate limits, authorization token, Supabase signup).
- **OTP management (resend):** Simple rate-limited proxy.
- **Account recovery (password reset):** Simple rate-limited proxy.

These should be separated into at minimum two handlers: registration (complex, security-critical) and account support operations (simple proxies). They can remain in the same file if file complexity stays manageable, but a separate `registration.service.ts` from `account.service.ts` would clarify ownership.

### 2. What should remain centralized

- Worker entry point (`index.ts`) remains a pure dispatcher.
- `response.ts` remains the single response shaping authority.
- `lib/auth-errors.ts` should be extended to cover order error codes in a consistent manner.
- `verifyUser()` remains the single identity verification path — no duplication.

### 3. Order operations requiring authoritative DB transactions

- **Order creation:** Must remain in a SECURITY DEFINER transaction (`create_order` RPC or equivalent). All product validation, price calculation, item insertion, cart clearing, and timeline creation must be atomic in one transaction.
- **Stock decrement (when implemented):** Must be atomic with the order INSERT to prevent overselling. The SELECT (availability check) and the UPDATE (stock decrement) must be in the same transaction with row-level locking (`SELECT ... FOR UPDATE`) on the product/variant rows being purchased.

### 4. Stock operations requiring atomic handling

The current availability check (`SELECT product WHERE availability != 'out-of-stock'`) and the missing stock decrement must become a single atomic operation before any inventory management can be reliable. The required pattern:

```
SELECT product FOR UPDATE  →  check availability  →  decrement stock  →  conditionally set availability
```

This must happen inside the `create_order` transaction (or an equivalent RPC). A separate "check then decrement" pattern across transactions is unsafe.

The `products.stock` integer column and `products.availability` enum must be reconciled into a single consistent representation, or the RPC must maintain them in sync atomically.

### 5. Database objects to consolidate

- `set_updated_at` and `touch_updated_at` should be consolidated into one function.
- `normalizeEmail` in `signup-auth.ts` should be removed and callers should use the `validation.ts` version.
- Order error codes should be added to `lib/auth-errors.ts`.

### 6. Objects to retain

- `signup_authorizations` table and indexes — security-critical.
- `consume_signup_authorization` RPC — atomic consumption must not be replaced.
- `hook_validate_signup_authorization` — final enforcement layer must not be weakened.
- `handle_new_auth_user` trigger — profile auto-creation is correct.
- `check_rate_limit` RPC — correct design, needs restricted permissions.
- `create_order` RPC architecture — correct transactional design, needs stock mutation and order ID improvements.
- `idx_orders_idempotency` unique partial index — idempotency enforcement.
- `cart_items UNIQUE(user_id, product_slug, variant_id)` — prevents duplicate cart entries.

### 7. Changes that must happen before restructuring

1. **Add `CHECK (quantity > 0)` to `cart_items.quantity`** and validate quantity in the Worker or RPC before order creation. This is a pre-requisite for any order integrity.
2. **Restrict `create_order` and `check_rate_limit` RPC execute permissions** to `service_role` only. Remove `anon` and `authenticated` grants. This closes the bypass gaps before any other order work.
3. **Remove hardcoded credential fallbacks** from `env.ts`, or document that the test project is ephemeral and will be replaced before production.
4. **Add timeout to `supabaseRestFetch`**.

### 8. Changes that can happen afterward

- Implement stock decrement in `create_order` after permissions are locked down.
- Improve order ID generation (UUID or high-entropy ID instead of year+random4).
- Separate `auth.service.ts` into focused service modules.
- Add IP rate limiting to the OTP resend endpoint.
- Consolidate duplicate DB functions.
- Move order error codes into the centralized error contract.

---

## Section 14 — Flow Diagrams

### 1. Registration (actual current implementation)

```
Browser
  |
  | POST /auth/register
  | { email, password, turnstileToken }
  v
Worker handleRegister()
  |
  +--[checkRateLimit "register:<ip>" 5/900s]----BLOCKED(429)
  |
  +--[validateRegistration]----FAIL(422)
  |
  +--[checkRateLimit "register:<email>" 3/900s]----BLOCKED(429)
  |
  +--[verifyTurnstile via Cloudflare siteverify]----FAIL(422)
  |
  +--[generateAuthorizationToken: 32-byte crypto-random]
  +--[sha256Hex(token) + emailHash(email)]
  |
  +--[INSERT signup_authorizations {token_hash, email_hash, expires_at=+300s}]
  |   via service-role REST----FAIL(502)
  |
  +--[POST /auth/v1/signup {email, password, data:{reg_auth:rawToken}}]
  |   via anon key
  |     |
  |     v
  |   Supabase Before User Created Hook
  |     hook_validate_signup_authorization(event)
  |       |
  |       +--extract email, reg_auth from event
  |       +--hash both
  |       +--consume_signup_authorization(email_hash, token_hash)
  |             UPDATE ... SET consumed_at=now()
  |             WHERE token_hash=? AND email_hash=?
  |             AND expires_at > now() AND consumed_at IS NULL
  |             |
  |             +--[NO ROW]----REJECT(403)
  |             +--[ROW]----ALLOW
  |
  |   Supabase creates unconfirmed auth.users row
  |   on_auth_user_created trigger fires
  |     INSERT profiles(id, email) ON CONFLICT DO NOTHING
  |   Supabase sends OTP email
  |
  v
Worker returns 200 { success: true, data: null }
  |
  v
Browser shows OTP entry UI
```

### 2. OTP Resend (actual)

```
Browser
  |
  | POST /auth/resend-signup { email }
  v
Worker handleResendSignup()
  |
  +--[validateEmailOnly]----FAIL(422)
  |
  +--[checkRateLimit "resend:<email>" 3/86400s]----BLOCKED(429, OTP_RESEND_RATE_LIMITED)
  |
  +--[POST /auth/v1/resend {email, type:"signup"}]
  |   via service-role
  |   |
  |   +--[FAIL]----429 RESEND_FAILED
  |   +--[OK]-----200 success
  v
Browser toast: success / error title
```

### 3. Password Reset / Account Recovery (actual)

```
Browser
  |
  | POST /auth/reset-password { email }
  v
Worker handleResetPassword()
  |
  +--[clientIp]
  +--[validateEmailOnly]----FAIL(422)
  |
  +--[checkRateLimit "reset:<email>:<ip>" 5/900s]----BLOCKED(429)
  |
  +--[POST /auth/v1/recover {email}]
  |   via service-role
  |   [result IGNORED]
  |
  v
200 { success: true, data: null }  (always, regardless of account existence)
```

### 4. Sign-in (no Worker involvement)

```
Browser
  |
  | supabase.auth.signInWithPassword({ email, password })
  | [Supabase JS SDK — direct to Supabase Auth]
  v
Supabase /auth/v1/token?grant_type=password
  |
  +--[invalid]----error
  +--[valid]------returns { access_token, refresh_token, user }
  v
AuthProvider.onAuthStateChange receives SIGNED_IN
  |
  v
Centralized auth state updates
```

### 5. Order Creation (actual)

```
Browser (CheckoutForm)
  |
  | supabase.auth.getSession() → access_token
  | POST /orders
  | Headers: Authorization: Bearer <access_token>
  | Body: { addressId, idempotencyKey }
  v
Worker handleCreateOrder()
  |
  +--[requireAuth: GET /auth/v1/user]----FAIL(401)
  |   returns { id, email }
  |
  +--[checkRateLimit "orders:<user.id>" 5/900s]----BLOCKED(429)
  |
  +--[validateOrderRequest: addressId, idempotencyKey]----FAIL(422)
  |
  +--[POST /rest/v1/rpc/create_order
  |    { p_user_id, p_address_id, p_idempotency_key }]
  |   via service-role
  |
  v
DB: create_order() [SECURITY DEFINER, single transaction]
  |
  +--[idempotency check]----already exists → return existing orderId
  |
  +--[address check: WHERE id=? AND user_id=?]----FAIL('ADDRESS_NOT_FOUND')
  |
  +--[generate orderId: FG-YYYY-NNNN]
  |
  +--[First pass: foreach cart_item]
  |   +--[product active check]----FAIL('PRODUCT_UNAVAILABLE')
  |   +--[availability check]------FAIL('OUT_OF_STOCK')
  |   +--[variant check if needed]-FAIL('VARIANT_UNAVAILABLE'/'VARIANT_OUT_OF_STOCK')
  |   +--[accumulate totals]
  |
  +--[IF subtotal=0]----FAIL('CART_EMPTY')
  |
  +--[calculate shipping (0 if >=4990, else 149)]
  +--[calculate total]
  |
  +--[INSERT orders (snapshot address, idempotency_key)]
  |   [EXCEPTION unique_violation → return existing orderId]
  |
  +--[Second pass: INSERT order_items (snapshot product data)]
  |   [NO availability re-check in second pass]
  |
  +--[INSERT order_timeline (5 steps)]
  |
  +--[DELETE cart_items WHERE user_id=p_user_id]
  |
  v
RETURN { orderId, total }
  |
Worker: maps RPC errors, returns success({ orderId, total })
  |
Browser: loadRemote(user.id) → toast → router.push('/checkout/success?order=...')
```

### 6. Stock Mutation (actual)

```
[No stock mutation occurs anywhere in the current system.]

Order created → products.availability: UNCHANGED
             → products.stock: UNCHANGED
             → product_variants.in_stock: UNCHANGED

Stock can only change via manual admin UPDATE on the products/product_variants tables.
```

### 7. Authentication/Session Interaction with Worker

```
[Sign-in] Browser → Supabase Auth directly (no Worker)
[OTP verify] Browser → Supabase Auth directly (no Worker)
[Session refresh] Browser → Supabase SDK handles automatically (no Worker)
[Logout] Browser → supabase.auth.signOut() directly (no Worker)

Worker uses session only at: POST /orders
  → reads Bearer token from Authorization header
  → validates via GET /auth/v1/user with service-role apikey + user JWT
  → derives user.id from the verified response
  → never issues tokens, never manages sessions
```

### 8. Checkout to Database Flow

```
Browser (CheckoutForm.tsx)
  |
  | 1. useAddresses() → Supabase client → SELECT addresses WHERE user_id=auth.uid()
  |    [direct DB via anon key + RLS]
  |
  | 2. User selects address, page generates idempotencyKey
  |
  | 3. handlePlaceOrder() called
  |    → createOrder(selectedAddressId, idempotencyKey) [services/worker.ts]
  |      → getSession() → access_token
  |      → POST /orders { addressId, idempotencyKey, Authorization: Bearer <token> }
  |
  v
Worker → auth → rate limit → validate → create_order RPC (service-role)
  |
  v
DB create_order transaction:
  reads:   addresses, cart_items, products, product_variants
  writes:  orders, order_items, order_timeline
  deletes: cart_items
  |
  v
Worker returns { success: true, data: { orderId, total } }
  |
  v
Browser:
  → useCart.getState().loadRemote(user.id)
    [reloads cart from DB — should now be empty]
  → toast.success with orderId
  → router.push('/checkout/success?order=<orderId>')
```

---

## Target Rewrite Concerns

These are the exact current concerns the next planning phase must solve — not a new architecture, just the proven gaps from this audit.

1. **No stock decrement.** Every order succeeds regardless of real inventory levels. Any stock system introduced must be atomic with the order INSERT.

2. **No quantity constraints.** `cart_items.quantity` accepts zero, negative, and arbitrarily large values. Both DB-level CHECK constraints and application-level validation are missing.

3. **`create_order` and `check_rate_limit` are callable by authenticated and anonymous users directly**, bypassing Worker security controls. These RPCs must be restricted to `service_role` only.

4. **Order ID collision risk.** The current `FG-YYYY-NNNN` scheme has 9,000 possible values per year with no retry on collision. A production-quality ID scheme is needed.

5. **`supabaseRestFetch` has no timeout.** Any slow Supabase response can hang the Worker indefinitely for RPC calls, authorization INSERTs, and rate limit checks.

6. **Hardcoded production credentials in `env.ts`.** The test project is live. Fallback keys must be removed or the project must be decommissioned before production deployment.

7. **Two inconsistent stock representations** (`products.availability` enum and `products.stock` integer) with no sync mechanism. The next stock implementation must define one authoritative representation.

8. **Price can silently change between checkout page load and order submission** with no user notification. If price integrity is required, a price-lock or conflict-detection mechanism is needed.

9. **No order status transition validation.** Any admin can set any order to any status. If status-gated operations (e.g., stock restoration on cancellation) are introduced, transition guards will be required.

10. **No IP rate limit on OTP resend.** Only email-based limiting exists. An attacker from a new IP can resend up to the daily limit for any known email.

11. **`set_updated_at` and `touch_updated_at` are duplicate DB functions.** Minor cleanup required before the schema grows further.

12. **`auth.service.ts` mixes registration, OTP support, and password recovery.** These need separation before the service grows to include more account operations.

13. **Order error codes are not in the centralized `lib/auth-errors.ts` contract.** They work via fallback but lack type safety and canonical mapping.

14. **The `cart_items` RLS policy grants `anon` Postgres-level privileges.** While RLS blocks unauthenticated writes (`auth.uid() = user_id` always fails for anon), `anon` having full Postgres grants on `cart_items` is a hardening gap.
