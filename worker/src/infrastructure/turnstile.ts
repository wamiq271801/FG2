/**
 * Turnstile infrastructure — centralized verification.
 *
 * Supports action-specific verification: each protected endpoint
 * specifies the expected action string that must match the token.
 */

import type { Env } from "../config/env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
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

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * @param env       - Worker environment (contains secret key and optional hostname)
 * @param token     - The Turnstile response token from the browser
 * @param expectedAction - The action string that must match (e.g. "signup", "otp_resend", "password_reset")
 * @param remoteIp  - Optional remote IP for Cloudflare verification
 * @returns true if the token is valid and matches the expected action
 */
export async function verifyTurnstile(
  env: Env,
  token: string,
  expectedAction: string,
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
    if (!data?.success) return false;
    if (data.action !== undefined && data.action !== expectedAction) return false;
    if (env.TURNSTILE_EXPECTED_HOSTNAME) {
      if (!data.hostname || data.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
