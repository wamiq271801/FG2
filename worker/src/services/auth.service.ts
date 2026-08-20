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

  const ipAllowed = await checkRateLimit(env, `register:${ip}`, 5, 900);
  if (!ipAllowed) return fail("RATE_LIMITED", "Too many attempts", 429);

  const body = await request.json().catch(() => null);
  const validation = validateRegistration(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", "Please check your details");

  const { email, password, turnstileToken } = validation.data;

  const emailAllowed = await checkRateLimit(env, `register:${email}`, 3, 900);
  if (!emailAllowed) return fail("RATE_LIMITED", "Too many attempts", 429);

  const turnstileOk = await verifyTurnstile(env, turnstileToken, ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", "Verification failed", 422);

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
    return fail("SIGNUP_FAILED", "Unable to create account", 502);
  }

  const signup = await supabaseSignup(env, email, password, {
    reg_auth: token,
  });

  if (!signup.ok) {
    const msg = typeof signup.body?.msg === "string" ? signup.body.msg
      : typeof signup.body?.message === "string" ? signup.body.message
      : "";

    if (/already registered|already exists/i.test(msg)) {
      return fail("EMAIL_EXISTS", "An account with this email already exists", 409);
    }
    if (signup.status === 422 || /not authorized|session expired/i.test(msg)) {
      return fail("SIGNUP_REJECTED", "Registration unavailable", 422);
    }
    if (signup.status === 400 && /captcha/i.test(msg)) {
      console.error("[register] Supabase captcha protection is enabled — disable it.");
      return fail("SIGNUP_FAILED", "Unable to create account", 500);
    }
    if (signup.status === 502) {
      return fail("SIGNUP_FAILED", "Unable to create account", 502);
    }
    console.error(`[register] Supabase signup failed: status=${signup.status}`);
    return fail("SIGNUP_FAILED", "Unable to create account", 500);
  }

  return success();
}

export async function handleResendSignup(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null);
  const validation = validateEmailOnly(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", "Please check your details");

  const email = validation.data.email;
  const allowed = await checkRateLimit(env, `resend:${email}`, 3, 86400);
  if (!allowed) return fail("OTP_RESEND_RATE_LIMITED", "Too many verification requests", 429);

  const result = await supabaseAuthFetch(env, "/auth/v1/resend", {
    email, type: "signup",
  });

  if (!result.ok) {
    return fail("RESEND_FAILED", "Unable to resend code", 429);
  }

  return success();
}

export async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request);
  const body = await request.json().catch(() => null);
  const validation = validateEmailOnly(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", "Please check your details");

  const email = validation.data.email;
  const allowed = await checkRateLimit(env, `reset:${email}:${ip}`, 5, 900);
  if (!allowed) return fail("RATE_LIMITED", "Too many attempts", 429);

  await supabaseAuthFetch(env, "/auth/v1/recover", { email });
  return success();
}
