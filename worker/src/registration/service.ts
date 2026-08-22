/**
 * Registration service — Phase 10
 * Rate-limit calls updated to use named structured checks from security/rate-limit.ts.
 * All policies applied exactly per implementation.md.
 */

import type { Env } from "../config/env";
import { supabaseAuthFetch, supabaseSignup } from "../infrastructure/supabase";
import { fail, success } from "../http/response";
import { validateRegistration, validateEmailOnly } from "./validation";
import {
  checkRegisterIp,
  checkRegisterEmail,
  checkOtpResendEmail,
  checkOtpResendIp,
  checkPasswordResetEmail,
  checkPasswordResetIp,
  checkPasswordResetCooldown,
  recordPasswordResetSuccess,
  clientIp,
} from "../security/rate-limit";
import { verifyTurnstile } from "../infrastructure/turnstile";
import {
  createSignupAuthorization,
  emailHash,
  generateAuthorizationToken,
  sha256Hex,
} from "./authorization";

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
  const ipAllowed = await checkRegisterIp(env, ip);
  if (!ipAllowed) return fail("RATE_LIMITED", undefined, 429);

  const body = await request.json().catch(() => null);
  const validation = validateRegistration(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { email, password, turnstileToken } = validation.data;

  // Email rate limit: 3 per 15 minutes
  const emailAllowed = await checkRegisterEmail(env, email);
  if (!emailAllowed) return fail("RATE_LIMITED", undefined, 429);

  const turnstileOk = await verifyTurnstile(env, turnstileToken, ip);
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

export async function handleResendSignup(request: Request, env: Env): Promise<Response> {
  const ip   = clientIp(request);
  const body = await request.json().catch(() => null);
  const validation = validateEmailOnly(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { email } = validation.data;

  // Email limit: 3 per 24 hours
  const emailAllowed = await checkOtpResendEmail(env, email);
  if (!emailAllowed) return fail("OTP_RESEND_RATE_LIMITED", undefined, 429);

  // IP burst: 5 per 5 minutes
  const ipAllowed = await checkOtpResendIp(env, ip);
  if (!ipAllowed) return fail("RATE_LIMITED", undefined, 429);

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
//   Email:   1 per 24 hours
//   IP:      3 per 24 hours
//   Cooldown: 24-hour lockout after a successful reset
//
// Enumeration-safe: always returns success regardless of whether the email
// exists. Supabase silently no-ops for unknown emails.

export async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  const ip   = clientIp(request);
  const body = await request.json().catch(() => null);
  const validation = validateEmailOnly(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { email } = validation.data;

  // Post-reset cooldown: if a successful reset was recorded in the last 24h,
  // reject immediately before the request reaches Supabase.
  const cooldownAllowed = await checkPasswordResetCooldown(env, email);
  if (!cooldownAllowed) return fail("RATE_LIMITED", undefined, 429);

  // Email limit: 1 per 24 hours
  const emailAllowed = await checkPasswordResetEmail(env, email);
  if (!emailAllowed) return fail("RATE_LIMITED", undefined, 429);

  // IP limit: 3 per 24 hours
  const ipAllowed = await checkPasswordResetIp(env, ip);
  if (!ipAllowed) return fail("RATE_LIMITED", undefined, 429);

  // Enumeration-safe — always succeed externally
  const result = await supabaseAuthFetch(env, "/auth/v1/recover", { email });

  // Record success only when Supabase acknowledged the request.
  // Unknown emails return 200 (Supabase no-ops silently) so this fires
  // for real resets and for unknown emails equally — intentional. The
  // cooldown protects the endpoint from enumeration regardless.
  if (result.ok) {
    await recordPasswordResetSuccess(env, email);
  }

  return success();
}
