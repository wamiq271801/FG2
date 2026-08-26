/**
 * Server-side catalog client — plain anon key, no cookies.
 *
 * Catalog reads are public (RLS allows anon read). No user session is needed,
 * so this client works in all server contexts including `generateStaticParams`
 * (which runs at build time without an HTTP request and cannot access cookies).
 *
 * For user-scoped reads (cart/wishlist/orders), use the browser client from
 * `lib/supabase/client.ts` (RLS-enforced, anon key).
 *
 * The client is a module-level singleton: creating a fresh supabase-js client
 * per query call re-built the auth/rest machinery on every catalog read.
 * This client is fully stateless by configuration (persistSession: false,
 * autoRefreshToken: false, anon key only), so sharing one instance across
 * requests is safe.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

function createCatalogClientInstance() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type CatalogClient = ReturnType<typeof createCatalogClientInstance>;

let catalogClient: CatalogClient | null = null;

export function createCatalogClient(): CatalogClient {
  if (!catalogClient) {
    catalogClient = createCatalogClientInstance();
  }
  return catalogClient;
}
