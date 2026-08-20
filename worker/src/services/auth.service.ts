import type { Env } from "../config/env";
import { supabaseAuthFetch, supabaseSignup } from "../lib/supabase";
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

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request);

  // Rate-limit BEFORE expensive work (Turnstile verify, DB write).
  const ipAllowed = await checkRateLimit(env, `register:${ip}`, 5, 900);
  if (!ipAllowed) return fail("RATE_LIMITED", "Too many attempts. Please wait a few minutes.", 429);

  const body = await request.json().catch(() => null);
  const validation = validateRegistration(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { fullName, email, password, turnstileToken } = validation.data;

  // Email-based limit (normalized). Keeps one address from driving abuse.
  const emailAllowed = await checkRateLimit(env, `register:${email}`, 3, 900);
  if (!emailAllowed) return fail("RATE_LIMITED", "Too many attempts. Please wait a few minutes.", 429);

  // Server-side Turnstile verification. Checks success, action=signup, hostname.
  const turnstileOk = await verifyTurnstile(env, turnstileToken, ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", "Verification failed. Please try again.", 422);

  // Generate a fresh one-time authorization token. Only the hash is stored.
  const token = generateAuthorizationToken();
  const tokenHash = await sha256Hex(token);
  const emailHashValue = await emailHash(email);

  const created = await createSignupAuthorization(
    env,
    tokenHash,
    emailHashValue,
    env.SIGNUP_AUTHZ_TTL_SECONDS
  );
  if (!created) {
    return fail("AUTHZ_ERROR", "Unable to authorize registration. Please try again.", 502);
  }

  // Call the normal Supabase Auth signup endpoint server-to-server.
  // The raw token travels only inside this Worker process — it is attached
  // to the signup metadata so the Before User Created hook can validate and
  // atomically consume it. It is never returned to the browser.
  const signup = await supabaseSignup(env, email, password, {
    full_name: fullName,
    reg_auth: token,
  });

  if (!signup.ok) {
    // Surface Supabase error messages in normalized form. Common cases:
    // 400 "User already registered" — already exists
    // 422 hook rejection — authorization invalid (shouldn't happen within TTL)
    // 4xx/5xx — other Supabase-side failures
    const msg = typeof signup.body?.msg === "string" ? signup.body.msg
      : typeof signup.body?.message === "string" ? signup.body.message
      : "";
    if (/already registered|already exists/i.test(msg)) {
      return fail("EMAIL_EXISTS", "An account with this email already exists.", 409);
    }
    if (signup.status === 422 || /not authorized|session expired/i.test(msg)) {
      return fail("SIGNUP_REJECTED", "Registration could not be completed. Please try again.", 422);
    }
    return fail("SIGNUP_FAILED", "Unable to create account. Please try again.", 502);
  }

  // Signup accepted — user created as unconfirmed, verification email sent.
  // No token, session, or user data returned to the browser.
  return success();
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
