// Hardcoded test project config — disposable. Production uses wrangler secrets.
export const SUPABASE_URL = "https://onyzjnitnekjhdexecdm.supabase.co";
export const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXpqbml0bmVramhkZXhlY2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzAzNzY1NSwiZXhwIjoyMTAyNjEzNjU1fQ.XcDlBReiaBQRg7xcftYqu5wMFG9zQhPTYvetc6G4Exk";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXpqbml0bmVramhkZXhlY2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMzc2NTUsImV4cCI6MjEwMjYxMzY1NX0.GqXaLdE4txXx5cooRRc4TS01OfjVzP4Sq8MxfpGY-HA";

// Turnstile — server-side secret only. Prefer TURNSTILE_SECRET_KEY from
// Worker bindings or worker/.dev.vars; this fallback is for local test usage.
export const TURNSTILE_SECRET_KEY_DEFAULT =
  "0x4AAAAAAEWdqp_RFhs9JjaawIIwjxLn4lM";
// Leave empty to skip the hostname check (test/preview hosts vary). Set to your
// production hostname to enforce origin matching.
export const TURNSTILE_EXPECTED_HOSTNAME_DEFAULT = "";
export const SIGNUP_AUTHZ_TTL_SECONDS_DEFAULT = 5 * 60; // 5 minutes — must be > Supabase round-trip

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_EXPECTED_HOSTNAME: string;
  SIGNUP_AUTHZ_TTL_SECONDS: number;
}

export function resolveEnv(env?: Partial<Env>): Env {
  const turnstileSecret = env?.TURNSTILE_SECRET_KEY || TURNSTILE_SECRET_KEY_DEFAULT;
  if (!turnstileSecret) {
    // Fail fast rather than running a degenerate gate. Set the Worker secret.
    throw new Error("TURNSTILE_SECRET_KEY is not configured on the Worker.");
  }
  return {
    SUPABASE_URL: env?.SUPABASE_URL || SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env?.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: env?.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
    TURNSTILE_SECRET_KEY: turnstileSecret,
    TURNSTILE_EXPECTED_HOSTNAME: (env?.TURNSTILE_EXPECTED_HOSTNAME || TURNSTILE_EXPECTED_HOSTNAME_DEFAULT).trim(),
    SIGNUP_AUTHZ_TTL_SECONDS: env?.SIGNUP_AUTHZ_TTL_SECONDS
      ? Number(env.SIGNUP_AUTHZ_TTL_SECONDS)
      : SIGNUP_AUTHZ_TTL_SECONDS_DEFAULT,
  };
}
