/**
 * Browser Supabase client — anon key only, RLS-enforced.
 *
 * Singleton: returns the SAME browser client instance on every call so that
 * auth state changes (signIn, signOut) propagate to all listeners (AuthProvider,
 * cart, wishlist, etc.). Without a singleton, each createBrowserClient() call
 * creates a separate instance with its own onAuthStateChange registry — the
 * AuthProvider's listener never receives sign-in events from a different instance.
 *
 * Safe to ship to the client: uses the PUBLIC anon key and is fully constrained
 * by Row-Level Security.
 */
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
