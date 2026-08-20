/**
 * Server-side catalog client — plain anon key, no cookies.
 *
 * Catalog reads are public (RLS allows anon read). No user session is needed,
 * so this client works in all server contexts including `generateStaticParams`
 * (which runs at build time without an HTTP request and cannot access cookies).
 *
 * For user-scoped reads (cart/wishlist/orders), use the browser client from
 * `lib/supabase/client.ts` (RLS-enforced, anon key).
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export function createCatalogClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
