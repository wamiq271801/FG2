/**
 * Registration service — Phase 10
 * Rate-limit calls updated to use named structured checks from security/rate-limit.ts.
 * All policies applied exactly per implementation.md.
 */

import type { Env } from "../config/env";
import { supabaseAuthFetch, supabaseSignup } from "../infrastructure/supabase";
import { fail, success } from "../http/response";
import { validateRegistration, validateEmailWithTurnstile } from "./validation";
import {
  checkRegisterIp,
  checkRegisterEmail,
  checkOtpResendEmail,
  checkOtpResendIp,
  checkPasswordResetEmail,
  checkPasswordResetIp,
  checkPasswordResetCooldown,
  recordPasswordResetCooldown,
  clientIp,
} from "../security/rate-limit";
import { verifyTurnstile } from "../infrastructure/turnstile";
import {
  createSignupAuthorization,
  emailHash,
  generateAuthorizationToken,
  sha256Hex,
} from "./authorization";

// ─── Helper: handle rate-limit result ────────────────────────────────────
//
// Converts a RateLimitResult into the appropriate Worker error response.
// Distinguishes infrastructure failures from actual rate-limit rejections.

function rateLimitFail(
  result: { allowed: boolean; reason?: "rate_limited" | "infrastructure_error" },
  rateLimitCode: "RATE_LIMITED" | "OTP_RESEND_RATE_LIMITED" = "RATE_LIMITED"
): ReturnType<typeof fail> | null {
  if (result.allowed) return null;
  if (result.reason === "infrastructure_error") {
    return fail("RATE_LIMITED", undefined, 429);
  }
  return fail(rateLimitCode, undefined, 429);
}

// ─── Register ─────────────────────────────────────────────────────────────
//
// Registration flow (per implementation.md — must not be changed):
//   Browser → Managed Turnstile → Worker /auth/register
//     → IP rate limit (5/900)
//     → input validation
//     → email rate limit (3/900)
//     → server-side Turnstile validation
//     → one-time signup authorization (hash-only)
//     → normal Supabase signup
//     → Before User Created Hook (atomic authorization consumption)
//     → unconfirmed user created → native Supabase OTP

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request);

  // IP rate limit: 5 per 15 minutes
  const ipResult = await checkRegisterIp(env, ip);
  const ipFail = rateLimitFail(ipResult);
  if (ipFail) return ipFail;

  const body = await request.json().catch(() => null);
  const validation = validateRegistration(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { email, password, turnstileToken } = validation.data;

  // Email rate limit: 3 per 15 minutes
  const emailResult = await checkRegisterEmail(env, email);
  const emailFail = rateLimitFail(emailResult);
  if (emailFail) return emailFail;

  const turnstileOk = await verifyTurnstile(env, turnstileToken, "signup", ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", undefined, 422);

  const token          = generateAuthorizationToken();
  const tokenHash      = await sha256Hex(token);
  const emailHashValue = await emailHash(email);

  const created = await createSignupAuthorization(
    env,
    tokenHash,
    emailHashValue,
    env.SIGNUP_AUTHZ_TTL_SECONDS
  );
  if (!created) return fail("SIGNUP_FAILED", undefined, 502);

  const signup = await supabaseSignup(env, email, password, { reg_auth: token });

  if (!signup.ok) {
    const msg =
      typeof signup.body?.msg     === "string" ? signup.body.msg :
      typeof signup.body?.message === "string" ? signup.body.message : "";

    if (/already registered|already exists/i.test(msg))
      return fail("EMAIL_EXISTS", undefined, 409);
    if (signup.status === 422 || /not authorized|session expired/i.test(msg))
      return fail("SIGNUP_REJECTED", undefined, 422);
    if (signup.status === 400 && /captcha/i.test(msg)) {
      console.error("[register] Supabase captcha protection is enabled — disable it.");
      return fail("SIGNUP_FAILED", undefined, 500);
    }
    if (signup.status === 502)
      return fail("SIGNUP_FAILED", undefined, 502);

    console.error(`[register] Supabase signup failed: status=${signup.status}`);
    return fail("SIGNUP_FAILED", undefined, 500);
  }

  return success();
}

// ─── Resend OTP ────────────────────────────────────────────────────────────
//
// OTP resend rate limits:
//   Email: 3 per 24 hours
//   IP:    5 per 5 minutes (burst protection)
//   Turnstile: required with action "otp_resend"

export async function handleResendSignup(request: Request, env: Env): Promise<Response> {
  const ip   = clientIp(request);
  const body = await request.json().catch(() => null);
  const validation = validateEmailWithTurnstile(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { email, turnstileToken } = validation.data;

  // Email limit: 3 per 24 hours
  const emailResult = await checkOtpResendEmail(env, email);
  const emailFail = rateLimitFail(emailResult, "OTP_RESEND_RATE_LIMITED");
  if (emailFail) return emailFail;

  // IP burst: 5 per 5 minutes
  const ipResult = await checkOtpResendIp(env, ip);
  const ipFail = rateLimitFail(ipResult);
  if (ipFail) return ipFail;

  // Turnstile verification
  const turnstileOk = await verifyTurnstile(env, turnstileToken, "otp_resend", ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", undefined, 422);

  const result = await supabaseAuthFetch(env, "/auth/v1/resend", {
    email,
    type: "signup",
  });
  if (!result.ok) return fail("RESEND_FAILED", undefined, 429);

  return success();
}

// ─── Password Reset ────────────────────────────────────────────────────────
//
// Password reset rate limits (intentionally aggressive):
//   Email:   1 per 24 hours (attempt limit)
//   IP:      3 per 24 hours (attempt limit)
//   Cooldown: 24-hour lockout after a successful reset (dedicated cooldown)
//   Turnstile: required with action "password_reset"
//
// Flow:
//   1. Validate email
//   2. Check email attempt limit
//   3. Check IP attempt limit
//   4. Check successful-reset cooldown (READ-ONLY)
//   5. Turnstile verification
//   6. Supabase /auth/v1/recover
//   7. If recovery acknowledged → record cooldown
//
// Enumeration-safe: always returns success regardless of whether the email
// exists. Supabase silently no-ops for unknown emails.

export async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  const ip   = clientIp(request);
  const body = await request.json().catch(() => null);
  const validation = validateEmailWithTurnstile(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { email, turnstileToken } = validation.data;

  // Email attempt limit: 1 per 24 hours
  const emailResult = await checkPasswordResetEmail(env, email);
  const emailFail = rateLimitFail(emailResult);
  if (emailFail) return emailFail;

  // IP attempt limit: 3 per 24 hours
  const ipResult = await checkPasswordResetIp(env, ip);
  const ipFail = rateLimitFail(ipResult);
  if (ipFail) return ipFail;

  // Post-reset cooldown: if a successful reset was recorded in the last 24h,
  // reject immediately before the request reaches Turnstile or Supabase.
  const cooldownResult = await checkPasswordResetCooldown(env, email);
  const cooldownFail = rateLimitFail(cooldownResult);
  if (cooldownFail) return cooldownFail;

  // Turnstile verification
  const turnstileOk = await verifyTurnstile(env, turnstileToken, "password_reset", ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", undefined, 422);

  // Enumeration-safe — always succeed externally
  const result = await supabaseAuthFetch(env, "/auth/v1/recover", { email });

  // Record cooldown only when Supabase acknowledged the request.
  // Unknown emails return 200 (Supabase no-ops silently) so this fires
  // for real resets and for unknown emails equally — intentional. The
  // cooldown protects the endpoint from enumeration regardless.
  if (result.ok) {
    await recordPasswordResetCooldown(env, email);
  }

  return success();
}
