import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseSecretKey, requireSupabaseUrl } from "./env";

/**
 * Privileged server-only Supabase client for the admin application.
 *
 * Uses the test project's secret key (sb_secret_*) — full data access,
 * bypasses RLS. Current official Supabase guidance: secret keys are
 * backend-only and must never reach the browser. This module is guarded
 * by `server-only`, so any accidental import from a Client Component
 * fails the build.
 *
 * Stateless by configuration — the admin never performs user-session
 * auth against Supabase, so session persistence/refresh is disabled.
 * A connection made with the secret key carries no user identity
 * (auth.uid() is null), which is exactly what the moderation stamp
 * trigger treats as the privileged path.
 */
function createAdminClientInstance() {
  return createSupabaseClient(requireSupabaseUrl(), requireSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type AdminClient = ReturnType<typeof createAdminClientInstance>;

let adminClient: AdminClient | null = null;

export function getAdminClient(): AdminClient {
  if (!adminClient) {
    adminClient = createAdminClientInstance();
  }
  return adminClient;
}
