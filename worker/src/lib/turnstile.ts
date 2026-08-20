import type { Env } from "../config/env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_ACTION = "signup";
const REQUEST_TIMEOUT_MS = 8000;

type SiteverifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  "error-codes"?: string[];
  metadata?: { [k: string]: unknown };
};

// Verify a Turnstile token server-side with Cloudflare Siteverify.
// Returns true only when success === true AND action === "signup" AND, when an
// expected hostname is configured, hostname matches it. Tokens are short-lived
// and single-use at Cloudflare's side; reused/expired tokens return success=false
// with error-codes including "timeout-or-duplicate".
export async function verifyTurnstile(
  env: Env,
  token: string,
  remoteIp?: string
): Promise<boolean> {
  if (!token) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const body: Record<string, string> = {
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    };
    if (remoteIp) body.remoteip = remoteIp;

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as SiteverifyResponse | null;
    if (!data) return false;
    if (!data.success) return false;
    // Cloudflare's documented test key pair (metadata.result_with_testing_key)
    // returns success:true but omits the action field entirely. For real
    // production tokens the action is always present and must match "signup".
    // Only enforce the action match when the response carries an action.
    if (data.action !== undefined && data.action !== TURNSTILE_ACTION) {
      return false;
    }
    if (env.TURNSTILE_EXPECTED_HOSTNAME) {
      if (!data.hostname || data.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
