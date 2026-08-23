/**
 * Security — rate limiting — Phase 10
 *
 * Uses the structured rate_limits table:
 *   action       — what operation is being rate-limited
 *   dimension    — 'ip' | 'email' | 'user'
 *   subject_hash — HMAC-SHA256 hex of the subject (IP or email),
 *                  or raw UUID for user dimension (UUID is not sensitive)
 *
 * Per implementation.md:
 *   - IP and email are hashed/HMACed before storage — raw values are never
 *     persisted in the rate-limit store.
 *   - User UUID is stored directly (not sensitive, no hashing needed).
 *   - No device fingerprinting. No screen size, GPU, canvas, font, timezone,
 *     or any other fingerprinting data is collected.
 *   - Protection is action + dimension based only.
 *
 * IP burst values (defined here, applied consistently):
 *   OTP resend IP burst:      5 per 5 minutes
 *   Order creation IP burst: 10 per 5 minutes
 *
 * All other exact policy values are defined in implementation.md and
 * applied in the callers (registration/service.ts, orders/service.ts).
 */

import type { Env } from "../config/env";
import { supabaseRestFetch } from "../infrastructure/supabase";

// ─── HMAC helper ──────────────────────────────────────────────────────────
//
// We use HMAC-SHA256 keyed with SUPABASE_SERVICE_ROLE_KEY as the HMAC secret.
// This prevents an attacker who gains read access to the rate_limits table
// from reverse-engineering the raw IP or email from the stored hash.
//
// The key is stable per deployment so hashes are deterministic within a
// deployment. If the key is rotated, the existing rate-limit records become
// unreachable (they will expire naturally via the window DELETE).

export async function hmacHex(env: Env, input: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(env.SUPABASE_SERVICE_ROLE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", keyMaterial, enc.encode(input));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// ─── Rate-limit result type ───────────────────────────────────────────────
//
// Distinguishes between:
//   { allowed: true }           — request permitted
//   { allowed: false }          — actual rate-limit rejection
//   { allowed: false, error }   — infrastructure failure (RPC error)

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "rate_limited" | "infrastructure_error" };

// ─── Core check ──────────────────────────────────────────────────────────
//
// Calls the check_rate_limit(action, dimension, subject_hash, max, window)
// RPC atomically (delete expired → insert → count → return).
// Returns a RateLimitResult distinguishing rate-limit from infrastructure error.

async function checkRateLimitRpc(
  env: Env,
  action: string,
  dimension: "ip" | "email" | "user",
  subjectHash: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/rpc/check_rate_limit",
    {
      p_action:          action,
      p_dimension:       dimension,
      p_subject_hash:    subjectHash,
      p_max:             max,
      p_window_seconds:  windowSeconds,
    }
  );

  // Infrastructure failure (network error, timeout, non-2xx response)
  if (!result.ok) {
    return { allowed: false, reason: "infrastructure_error" };
  }

  // RPC returned a value — check if it's the expected boolean
  if (typeof result.data !== "boolean") {
    return { allowed: false, reason: "infrastructure_error" };
  }

  return result.data ? { allowed: true } : { allowed: false, reason: "rate_limited" };
}

// ─── Cooldown RPC ────────────────────────────────────────────────────────
//
// Calls the dedicated cooldown functions for password-reset success tracking.
// These are separate from the generic rate limiter.

async function callCooldownRpc(
  env: Env,
  functionName: string,
  emailHash: string,
  windowSeconds?: number
): Promise<RateLimitResult> {
  const params: Record<string, unknown> = { p_email_hash: emailHash };
  if (windowSeconds !== undefined) {
    params.p_window_seconds = windowSeconds;
  }

  const result = await supabaseRestFetch(
    env,
    "POST",
    `/rest/v1/rpc/${functionName}`,
    params
  );

  if (!result.ok) {
    return { allowed: false, reason: "infrastructure_error" };
  }

  if (functionName === "check_password_reset_cooldown") {
    return result.data === true
      ? { allowed: true }
      : { allowed: false, reason: "rate_limited" };
  }

  // record_password_reset_cooldown doesn't return a value — success means recorded
  return { allowed: true };
}

// ─── Public rate-limit checks ─────────────────────────────────────────────
//
// One named function per action + dimension combination.
// Callers never construct rate-limit keys manually — all key logic lives here.
// Each function returns RateLimitResult for proper error handling.

/**
 * Registration — IP dimension.
 * Policy: 5 attempts per 15 minutes.
 */
export async function checkRegisterIp(env: Env, ip: string): Promise<RateLimitResult> {
  const hash = await hmacHex(env, ip);
  return checkRateLimitRpc(env, "register", "ip", hash, 5, 900);
}

/**
 * Registration — email dimension.
 * Policy: 3 attempts per 15 minutes.
 */
export async function checkRegisterEmail(env: Env, email: string): Promise<RateLimitResult> {
  const hash = await hmacHex(env, email);
  return checkRateLimitRpc(env, "register", "email", hash, 3, 900);
}

/**
 * OTP resend — email dimension.
 * Policy: 3 attempts per 24 hours.
 */
export async function checkOtpResendEmail(env: Env, email: string): Promise<RateLimitResult> {
  const hash = await hmacHex(env, email);
  return checkRateLimitRpc(env, "otp_resend", "email", hash, 3, 86400);
}

/**
 * OTP resend — IP burst protection.
 * Policy: 5 per 5 minutes.
 * Defined value: 5/300 — applied consistently per implementation.md requirement.
 */
export async function checkOtpResendIp(env: Env, ip: string): Promise<RateLimitResult> {
  const hash = await hmacHex(env, ip);
  return checkRateLimitRpc(env, "otp_resend", "ip", hash, 5, 300);
}

/**
 * Password reset — email dimension.
 * Policy: 1 attempt per 24 hours (intentionally aggressive).
 */
export async function checkPasswordResetEmail(env: Env, email: string): Promise<RateLimitResult> {
  const hash = await hmacHex(env, email);
  return checkRateLimitRpc(env, "password_reset", "email", hash, 1, 86400);
}

/**
 * Password reset — IP dimension.
 * Policy: 3 attempts per 24 hours.
 */
export async function checkPasswordResetIp(env: Env, ip: string): Promise<RateLimitResult> {
  const hash = await hmacHex(env, ip);
  return checkRateLimitRpc(env, "password_reset", "ip", hash, 3, 86400);
}

/**
 * Password reset — post-success cooldown check (READ-ONLY).
 * Policy: after a successful reset, block another reset for 24 hours.
 * Returns true if NO active cooldown exists (allowed to proceed).
 */
export async function checkPasswordResetCooldown(env: Env, email: string): Promise<RateLimitResult> {
  const hash = await hmacHex(env, email);
  return callCooldownRpc(env, "check_password_reset_cooldown", hash, 86400);
}

/**
 * Password reset — record successful cooldown (WRITE).
 * Called ONLY after Supabase recovery is successfully acknowledged.
 */
export async function recordPasswordResetCooldown(env: Env, email: string): Promise<void> {
  const hash = await hmacHex(env, email);
  await callCooldownRpc(env, "record_password_reset_cooldown", hash);
}

/**
 * Order creation — user dimension.
 * Policy: 5 attempts per 15 minutes.
 * User UUID is stored directly (not hashed — UUID is not sensitive PII).
 */
export async function checkOrderCreationUser(env: Env, userId: string): Promise<RateLimitResult> {
  return checkRateLimitRpc(env, "order_create", "user", userId, 5, 900);
}

/**
 * Order creation — IP burst protection.
 * Policy: 10 per 5 minutes.
 * Defined value: 10/300 — applied consistently per implementation.md requirement.
 */
export async function checkOrderCreationIp(env: Env, ip: string): Promise<RateLimitResult> {
  const hash = await hmacHex(env, ip);
  return checkRateLimitRpc(env, "order_create", "ip", hash, 10, 300);
}

// ─── IP extraction ────────────────────────────────────────────────────────

/** Extract the client IP from standard Cloudflare / proxy headers. */
export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
