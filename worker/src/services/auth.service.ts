import type { Env } from "../config/env";
import { supabaseAuthFetch } from "../lib/supabase";
import { fail, success } from "../lib/response";
import { validateRegistration, validateEmailOnly } from "../lib/validation";
import { checkRateLimit, clientIp } from "../middleware/rate-limit";
import { verifyTurnstile } from "../lib/turnstile";
import {
  createSignupAuthorization,
  emailHash,
  generateAuthorizationToken,
  sha256Hex,
} from "../lib/signup-auth";

// Worker is a security gate only. It does NOT create the Supabase user, send
// OTP, or keep execution alive during OTP entry. It issues a short-lived,
// single-use registration authorization that the Supabase Before User Created
// hook validates + consumes atomically.
export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request);

  // Rate-limit BEFORE expensive work (Turnstile verify, DB write).
  const ipAllowed = await checkRateLimit(env, `register:${ip}`, 5, 900);
  if (!ipAllowed) return fail("RATE_LIMITED", "Too many attempts. Please wait a few minutes.", 429);

  const body = await request.json().catch(() => null);
  const validation = validateRegistration(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { email, password, turnstileToken } = validation.data;

  // Email-based limit (normalized). Keeps one address from driving abuse.
  const emailAllowed = await checkRateLimit(env, `register:${email}`, 3, 900);
  if (!emailAllowed) return fail("RATE_LIMITED", "Too many attempts. Please wait a few minutes.", 429);

  // Server-side Turnstile verification. Checks success, action=signup, hostname.
  const turnstileOk = await verifyTurnstile(env, turnstileToken, ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", "Verification failed. Please try again.", 422);

  // Generate a fresh one-time authorization token. Hash it + the email.
  const token = generateAuthorizationToken();
  const tokenHash = await sha256Hex(token);
  const emailHashValue = await emailHash(email);

  // Store ONLY the hash. Raw token returns to the frontend for the immediate
  // native signUp() call, then is consumed by the Supabase hook.
  const created = await createSignupAuthorization(
    env,
    tokenHash,
    emailHashValue,
    env.SIGNUP_AUTHZ_TTL_SECONDS
  );
  if (!created) {
    return fail("AUTHZ_ERROR", "Unable to authorize registration. Please try again.", 502);
  }

  // Worker's job is done — return the raw token. The frontend immediately
  // calls supabase.auth.signUp(...) with it in signup metadata.
  // Password is never logged. The raw token is never logged.
  return success({ authorization: token });
}

export async function handleResendSignup(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null);
  const validation = validateEmailOnly(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const email = validation.data.email;
  const allowed = await checkRateLimit(env, `resend:${email}`, 3, 86400);
  if (!allowed) return fail("RATE_LIMITED", "Too many resend attempts for this email. Please try again tomorrow.", 429);

  const result = await supabaseAuthFetch(env, "/auth/v1/resend", {
    email, type: "signup",
  });

  if (!result.ok) {
    return fail("RESEND_FAILED", "Unable to send code. Please try again.", 429);
  }

  return success();
}

export async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request);
  const body = await request.json().catch(() => null);
  const validation = validateEmailOnly(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const email = validation.data.email;
  const allowed = await checkRateLimit(env, `reset:${email}:${ip}`, 5, 900);
  if (!allowed) return fail("RATE_LIMITED", "Too many attempts. Please wait.", 429);

  await supabaseAuthFetch(env, "/auth/v1/recover", { email });
  // Always return success — don't leak whether account exists.
  return success();
}
