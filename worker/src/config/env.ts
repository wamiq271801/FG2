// Worker environment configuration.
//
// All secrets MUST be set as Wrangler secrets (production) or in
// worker/.dev.vars (local development). There are no source-code fallback
// values for any secret. The Worker refuses to start if a required secret
// is absent — this prevents a misconfigured deployment from silently running
// with missing credentials.
//
// Required secrets (set via `wrangler secret put <NAME>`):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY
//   TURNSTILE_SECRET_KEY
//
// Optional:
//   TURNSTILE_EXPECTED_HOSTNAME  — enforce origin hostname on Turnstile tokens
//                                  (empty = skip hostname check, safe for dev)
//   SIGNUP_AUTHZ_TTL_SECONDS     — authorization window in seconds (default 300)

export const SIGNUP_AUTHZ_TTL_SECONDS_DEFAULT = 5 * 60; // 5 minutes

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_EXPECTED_HOSTNAME: string;
  SIGNUP_AUTHZ_TTL_SECONDS: number;
}

export function resolveEnv(env?: Partial<Env>): Env {
  const supabaseUrl = env?.SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured. Set it as a Wrangler secret or in .dev.vars.");
  }

  const serviceRoleKey = env?.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured. Set it as a Wrangler secret or in .dev.vars.");
  }

  const anonKey = env?.SUPABASE_ANON_KEY?.trim();
  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY is not configured. Set it as a Wrangler secret or in .dev.vars.");
  }

  const turnstileSecret = env?.TURNSTILE_SECRET_KEY?.trim();
  if (!turnstileSecret) {
    throw new Error("TURNSTILE_SECRET_KEY is not configured. Set it as a Wrangler secret or in .dev.vars.");
  }

  return {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_ANON_KEY: anonKey,
    TURNSTILE_SECRET_KEY: turnstileSecret,
    TURNSTILE_EXPECTED_HOSTNAME: (env?.TURNSTILE_EXPECTED_HOSTNAME ?? "").trim(),
    SIGNUP_AUTHZ_TTL_SECONDS: env?.SIGNUP_AUTHZ_TTL_SECONDS
      ? Number(env.SIGNUP_AUTHZ_TTL_SECONDS)
      : SIGNUP_AUTHZ_TTL_SECONDS_DEFAULT,
  };
}
