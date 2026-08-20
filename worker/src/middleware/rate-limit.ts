import type { Env } from "../config/env";
import { supabaseRestFetch } from "../lib/supabase";

// Atomic rate-limit check via Supabase RPC
// Returns true if allowed, false if rate-limited.
export async function checkRateLimit(
  env: Env,
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/rpc/check_rate_limit",
    { p_key: key, p_max: max, p_window_seconds: windowSeconds }
  );
  return result.ok && result.data === true;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
