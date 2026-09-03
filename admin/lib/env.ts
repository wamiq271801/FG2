import "server-only";

/**
 * Server-only admin environment.
 *
 * SUPABASE_SECRET_KEY is the project's current-format secret key
 * (sb_secret_*) — the privileged server credential that bypasses RLS.
 * It must NEVER be exposed to the browser:
 *   - no NEXT_PUBLIC_* prefix
 *   - never imported by client components (this module is server-only)
 *   - never returned from server actions or rendered into HTML
 *   - lives only in admin/.env.local, which is git-ignored
 */
export function requireSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is not configured (admin/.env.local)");
  return url;
}

export function requireSupabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not configured (admin/.env.local)");
  return key;
}

export function requireAdminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD is not configured (admin/.env.local)");
  return pw;
}

export function requireAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured (admin/.env.local)");
  return secret;
}

/**
 * Storefront cache-invalidation endpoint (the storefront owns the whole
 * invalidation system; the admin only emits domain events to it).
 * Falls back to the local dev storefront when unset.
 */
export function requireStorefrontRevalidateUrl(): string {
  return (
    process.env.STOREFRONT_REVALIDATE_URL ?? "http://127.0.0.1:3000/api/revalidate"
  );
}

/**
 * Shared bearer secret for POST /api/revalidate. Server-only like every
 * secret here: never NEXT_PUBLIC_*, never rendered, never logged, never
 * included in error messages or URLs.
 */
export function requireStorefrontRevalidateSecret(): string {
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET;
  if (!secret) {
    throw new Error("STOREFRONT_REVALIDATE_SECRET is not configured (admin/.env.local)");
  }
  return secret;
}
