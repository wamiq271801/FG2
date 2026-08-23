var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/config/env.ts
var SIGNUP_AUTHZ_TTL_SECONDS_DEFAULT = 5 * 60;
function resolveEnv(env) {
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
    SIGNUP_AUTHZ_TTL_SECONDS: env?.SIGNUP_AUTHZ_TTL_SECONDS ? Number(env.SIGNUP_AUTHZ_TTL_SECONDS) : SIGNUP_AUTHZ_TTL_SECONDS_DEFAULT
  };
}
__name(resolveEnv, "resolveEnv");

// src/http/errors.ts
var MESSAGES = {
  // Auth
  UNAUTHORIZED: "Authentication required.",
  // Rate limits
  RATE_LIMITED: "Too many attempts. Please wait a moment.",
  OTP_RESEND_RATE_LIMITED: "Too many verification requests. Please wait before trying again.",
  // Registration
  VALIDATION_ERROR: "Please check your details.",
  TURNSTILE_FAILED: "Verification failed. Please try again.",
  EMAIL_EXISTS: "An account with this email already exists.",
  SIGNUP_REJECTED: "Registration is currently unavailable.",
  SIGNUP_FAILED: "Unable to create account. Please try again.",
  RESEND_FAILED: "Unable to resend verification code.",
  // Password reset
  RESET_FAILED: "Unable to send reset link.",
  // OTP
  OTP_INVALID: "Invalid verification code.",
  OTP_EXPIRED: "That code has expired. Please request a new one.",
  // Sign-in
  SIGNIN_FAILED: "Incorrect email or password.",
  // Orders
  ORDER_FAILED: "Unable to create order. Please try again.",
  ORDER_PRICE_CHANGED: "Prices changed since your last checkout. Please review and confirm.",
  ORDER_ADDRESS_NOT_FOUND: "Selected address not found. Please choose another.",
  ORDER_CART_EMPTY: "Your cart is empty.",
  // Inventory
  INVENTORY_UNAVAILABLE: "A product in your cart is no longer available.",
  INVENTORY_NOT_PURCHASABLE: "This product is not currently available.",
  INVENTORY_OUT_OF_STOCK: "A product in your cart is out of stock.",
  INVENTORY_CANNOT_CANCEL: "This order can no longer be cancelled.",
  INVENTORY_CANNOT_RETURN: "Only delivered orders can be returned.",
  // Checkout
  SUMMARY_FAILED: "Unable to load checkout summary. Please try again.",
  // Generic
  NOT_FOUND: "The requested resource was not found.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again."
};
var FALLBACK_MESSAGE = "Something went wrong. Please try again.";
function workerError(code, message, status = 422) {
  const displayMessage = message ?? MESSAGES[code] ?? FALLBACK_MESSAGE;
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message: displayMessage, status }
    }),
    {
      status,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type, Authorization"
      }
    }
  );
}
__name(workerError, "workerError");

// src/http/response.ts
function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization"
    }
  });
}
__name(json, "json");
function success(data = null) {
  return json({ success: true, data }, 200);
}
__name(success, "success");
function fail(code, message, status = 422) {
  return workerError(code, message, status);
}
__name(fail, "fail");
function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-max-age": "86400"
    }
  });
}
__name(corsPreflight, "corsPreflight");

// src/infrastructure/supabase.ts
var DEFAULT_TIMEOUT = 1e4;
async function supabaseSignup(env, email, password, data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({ email, password, data }),
      signal: controller.signal
    });
    const text = await res.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
      }
    }
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 502, body: {} };
  } finally {
    clearTimeout(timeout);
  }
}
__name(supabaseSignup, "supabaseSignup");
async function supabaseAuthFetch(env, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(`${env.SUPABASE_URL}${path}`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
      }
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 502 };
  } finally {
    clearTimeout(timeout);
  }
}
__name(supabaseAuthFetch, "supabaseAuthFetch");
async function supabaseRestFetch(env, method, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(`${env.SUPABASE_URL}${path}`, {
      method,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0,
      signal: controller.signal
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
      }
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 502, data: null };
  } finally {
    clearTimeout(timeout);
  }
}
__name(supabaseRestFetch, "supabaseRestFetch");
async function verifyUser(env, request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data?.id || !data?.email) return null;
    return { id: data.id, email: data.email };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
__name(verifyUser, "verifyUser");

// src/registration/authorization.ts
async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
__name(sha256Hex, "sha256Hex");
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
__name(normalizeEmail, "normalizeEmail");
async function emailHash(email) {
  return sha256Hex(normalizeEmail(email));
}
__name(emailHash, "emailHash");
function generateAuthorizationToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(generateAuthorizationToken, "generateAuthorizationToken");
async function createSignupAuthorization(env, tokenHash, emailHashValue, ttlSeconds) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1e3).toISOString();
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/signup_authorizations",
    { token_hash: tokenHash, email_hash: emailHashValue, expires_at: expiresAt }
  );
  return result.ok && (result.status === 201 || result.status === 200);
}
__name(createSignupAuthorization, "createSignupAuthorization");

// src/registration/validation.ts
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PW_UPPERCASE_RE = /[A-Z]/;
var PW_NUMBER_RE = /[0-9]/;
var PW_SPECIAL_RE = /[^A-Za-z0-9]/;
function isValidEmail(email) {
  return EMAIL_RE.test(email);
}
__name(isValidEmail, "isValidEmail");
function validatePassword(password) {
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (password.length > 72) return { ok: false, error: "Password is too long (max 72)." };
  if (!PW_UPPERCASE_RE.test(password)) return { ok: false, error: "Password must include at least one uppercase letter." };
  if (!PW_NUMBER_RE.test(password)) return { ok: false, error: "Password must include at least one number." };
  if (!PW_SPECIAL_RE.test(password)) return { ok: false, error: "Password must include at least one special character." };
  return { ok: true };
}
__name(validatePassword, "validatePassword");
function validateRegistration(body) {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body." };
  const b = body;
  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  const password = typeof b.password === "string" ? b.password : "";
  const turnstileToken = typeof b.turnstileToken === "string" ? b.turnstileToken.trim() : "";
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) return { ok: false, error: pwCheck.error };
  if (!turnstileToken) return { ok: false, error: "Verification failed. Please try again." };
  return { ok: true, data: { email, password, turnstileToken } };
}
__name(validateRegistration, "validateRegistration");
function validateEmailWithTurnstile(body) {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body." };
  const b = body;
  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  const turnstileToken = typeof b.turnstileToken === "string" ? b.turnstileToken.trim() : "";
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (!turnstileToken) return { ok: false, error: "Verification failed. Please try again." };
  return { ok: true, data: { email, turnstileToken } };
}
__name(validateEmailWithTurnstile, "validateEmailWithTurnstile");

// src/security/rate-limit.ts
async function hmacHex(env, input) {
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
__name(hmacHex, "hmacHex");
async function checkRateLimitRpc(env, action, dimension, subjectHash, max, windowSeconds) {
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/rpc/check_rate_limit",
    {
      p_action: action,
      p_dimension: dimension,
      p_subject_hash: subjectHash,
      p_max: max,
      p_window_seconds: windowSeconds
    }
  );
  if (!result.ok) {
    return { allowed: false, reason: "infrastructure_error" };
  }
  if (typeof result.data !== "boolean") {
    return { allowed: false, reason: "infrastructure_error" };
  }
  return result.data ? { allowed: true } : { allowed: false, reason: "rate_limited" };
}
__name(checkRateLimitRpc, "checkRateLimitRpc");
async function callCooldownRpc(env, functionName, emailHash2, windowSeconds) {
  const params = { p_email_hash: emailHash2 };
  if (windowSeconds !== void 0) {
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
    return result.data === true ? { allowed: true } : { allowed: false, reason: "rate_limited" };
  }
  return { allowed: true };
}
__name(callCooldownRpc, "callCooldownRpc");
async function checkRegisterIp(env, ip) {
  const hash = await hmacHex(env, ip);
  return checkRateLimitRpc(env, "register", "ip", hash, 5, 900);
}
__name(checkRegisterIp, "checkRegisterIp");
async function checkRegisterEmail(env, email) {
  const hash = await hmacHex(env, email);
  return checkRateLimitRpc(env, "register", "email", hash, 3, 900);
}
__name(checkRegisterEmail, "checkRegisterEmail");
async function checkOtpResendEmail(env, email) {
  const hash = await hmacHex(env, email);
  return checkRateLimitRpc(env, "otp_resend", "email", hash, 3, 86400);
}
__name(checkOtpResendEmail, "checkOtpResendEmail");
async function checkOtpResendIp(env, ip) {
  const hash = await hmacHex(env, ip);
  return checkRateLimitRpc(env, "otp_resend", "ip", hash, 5, 300);
}
__name(checkOtpResendIp, "checkOtpResendIp");
async function checkPasswordResetEmail(env, email) {
  const hash = await hmacHex(env, email);
  return checkRateLimitRpc(env, "password_reset", "email", hash, 1, 86400);
}
__name(checkPasswordResetEmail, "checkPasswordResetEmail");
async function checkPasswordResetIp(env, ip) {
  const hash = await hmacHex(env, ip);
  return checkRateLimitRpc(env, "password_reset", "ip", hash, 3, 86400);
}
__name(checkPasswordResetIp, "checkPasswordResetIp");
async function checkPasswordResetCooldown(env, email) {
  const hash = await hmacHex(env, email);
  return callCooldownRpc(env, "check_password_reset_cooldown", hash, 86400);
}
__name(checkPasswordResetCooldown, "checkPasswordResetCooldown");
async function recordPasswordResetCooldown(env, email) {
  const hash = await hmacHex(env, email);
  await callCooldownRpc(env, "record_password_reset_cooldown", hash);
}
__name(recordPasswordResetCooldown, "recordPasswordResetCooldown");
async function checkOrderCreationUser(env, userId) {
  return checkRateLimitRpc(env, "order_create", "user", userId, 5, 900);
}
__name(checkOrderCreationUser, "checkOrderCreationUser");
async function checkOrderCreationIp(env, ip) {
  const hash = await hmacHex(env, ip);
  return checkRateLimitRpc(env, "order_create", "ip", hash, 10, 300);
}
__name(checkOrderCreationIp, "checkOrderCreationIp");
function clientIp(request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
__name(clientIp, "clientIp");

// src/infrastructure/turnstile.ts
var SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
var REQUEST_TIMEOUT_MS = 8e3;
async function verifyTurnstile(env, token, expectedAction, remoteIp) {
  if (!token) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const body = {
      secret: env.TURNSTILE_SECRET_KEY,
      response: token
    };
    if (remoteIp) body.remoteip = remoteIp;
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    if (!data?.success) return false;
    if (data.action !== void 0 && data.action !== expectedAction) return false;
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
__name(verifyTurnstile, "verifyTurnstile");

// src/registration/service.ts
function rateLimitFail(result, rateLimitCode = "RATE_LIMITED") {
  if (result.allowed) return null;
  if (result.reason === "infrastructure_error") {
    return fail("RATE_LIMITED", void 0, 429);
  }
  return fail(rateLimitCode, void 0, 429);
}
__name(rateLimitFail, "rateLimitFail");
async function handleRegister(request, env) {
  const ip = clientIp(request);
  const ipResult = await checkRegisterIp(env, ip);
  const ipFail = rateLimitFail(ipResult);
  if (ipFail) return ipFail;
  const body = await request.json().catch(() => null);
  const validation = validateRegistration(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);
  const { email, password, turnstileToken } = validation.data;
  const emailResult = await checkRegisterEmail(env, email);
  const emailFail = rateLimitFail(emailResult);
  if (emailFail) return emailFail;
  const turnstileOk = await verifyTurnstile(env, turnstileToken, "signup", ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", void 0, 422);
  const token = generateAuthorizationToken();
  const tokenHash = await sha256Hex(token);
  const emailHashValue = await emailHash(email);
  const created = await createSignupAuthorization(
    env,
    tokenHash,
    emailHashValue,
    env.SIGNUP_AUTHZ_TTL_SECONDS
  );
  if (!created) return fail("SIGNUP_FAILED", void 0, 502);
  const signup = await supabaseSignup(env, email, password, { reg_auth: token });
  if (!signup.ok) {
    const msg = typeof signup.body?.msg === "string" ? signup.body.msg : typeof signup.body?.message === "string" ? signup.body.message : "";
    if (/already registered|already exists/i.test(msg))
      return fail("EMAIL_EXISTS", void 0, 409);
    if (signup.status === 422 || /not authorized|session expired/i.test(msg))
      return fail("SIGNUP_REJECTED", void 0, 422);
    if (signup.status === 400 && /captcha/i.test(msg)) {
      console.error("[register] Supabase captcha protection is enabled \u2014 disable it.");
      return fail("SIGNUP_FAILED", void 0, 500);
    }
    if (signup.status === 502)
      return fail("SIGNUP_FAILED", void 0, 502);
    console.error(`[register] Supabase signup failed: status=${signup.status}`);
    return fail("SIGNUP_FAILED", void 0, 500);
  }
  return success();
}
__name(handleRegister, "handleRegister");
async function handleResendSignup(request, env) {
  const ip = clientIp(request);
  const body = await request.json().catch(() => null);
  const validation = validateEmailWithTurnstile(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);
  const { email, turnstileToken } = validation.data;
  const emailResult = await checkOtpResendEmail(env, email);
  const emailFail = rateLimitFail(emailResult, "OTP_RESEND_RATE_LIMITED");
  if (emailFail) return emailFail;
  const ipResult = await checkOtpResendIp(env, ip);
  const ipFail = rateLimitFail(ipResult);
  if (ipFail) return ipFail;
  const turnstileOk = await verifyTurnstile(env, turnstileToken, "otp_resend", ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", void 0, 422);
  const result = await supabaseAuthFetch(env, "/auth/v1/resend", {
    email,
    type: "signup"
  });
  if (!result.ok) return fail("RESEND_FAILED", void 0, 429);
  return success();
}
__name(handleResendSignup, "handleResendSignup");
async function handleResetPassword(request, env) {
  const ip = clientIp(request);
  const body = await request.json().catch(() => null);
  const validation = validateEmailWithTurnstile(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);
  const { email, turnstileToken } = validation.data;
  const emailResult = await checkPasswordResetEmail(env, email);
  const emailFail = rateLimitFail(emailResult);
  if (emailFail) return emailFail;
  const ipResult = await checkPasswordResetIp(env, ip);
  const ipFail = rateLimitFail(ipResult);
  if (ipFail) return ipFail;
  const cooldownResult = await checkPasswordResetCooldown(env, email);
  const cooldownFail = rateLimitFail(cooldownResult);
  if (cooldownFail) return cooldownFail;
  const turnstileOk = await verifyTurnstile(env, turnstileToken, "password_reset", ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", void 0, 422);
  const result = await supabaseAuthFetch(env, "/auth/v1/recover", { email });
  if (result.ok) {
    await recordPasswordResetCooldown(env, email);
  }
  return success();
}
__name(handleResetPassword, "handleResetPassword");

// src/registration/route.ts
async function registrationRoutes(request, env, pathname, method) {
  if (pathname === "/auth/register" && method === "POST") return handleRegister(request, env);
  if (pathname === "/auth/resend-signup" && method === "POST") return handleResendSignup(request, env);
  if (pathname === "/auth/reset-password" && method === "POST") return handleResetPassword(request, env);
  return null;
}
__name(registrationRoutes, "registrationRoutes");

// src/orders/validation.ts
function validateOrderRequest(body) {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request." };
  const b = body;
  const addressId = typeof b.addressId === "string" ? b.addressId.trim() : "";
  const idempotencyKey = typeof b.idempotencyKey === "string" ? b.idempotencyKey.trim() : "";
  if (!addressId) return { ok: false, error: "A delivery address is required." };
  if (!idempotencyKey || idempotencyKey.length > 100) return { ok: false, error: "Invalid checkout request." };
  return { ok: true, data: { addressId, idempotencyKey } };
}
__name(validateOrderRequest, "validateOrderRequest");

// src/security/auth.ts
async function requireAuth(env, request) {
  return verifyUser(env, request);
}
__name(requireAuth, "requireAuth");

// src/orders/service.ts
async function handleCreateOrder(request, env) {
  const user = await requireAuth(env, request);
  if (!user) return fail("UNAUTHORIZED", void 0, 401);
  const ip = clientIp(request);
  const userResult = await checkOrderCreationUser(env, user.id);
  if (!userResult.allowed) {
    if (userResult.reason === "infrastructure_error") {
      return fail("RATE_LIMITED", void 0, 429);
    }
    return fail("RATE_LIMITED", "Too many checkout attempts. Please wait a moment.", 429);
  }
  const ipResult = await checkOrderCreationIp(env, ip);
  if (!ipResult.allowed) {
    if (ipResult.reason === "infrastructure_error") {
      return fail("RATE_LIMITED", void 0, 429);
    }
    return fail("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
  }
  const body = await request.json().catch(() => null);
  const validation = validateOrderRequest(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);
  const { addressId, idempotencyKey } = validation.data;
  const expectedTotal = typeof body?.expectedTotal === "number" ? body.expectedTotal : null;
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/rpc/create_order",
    {
      p_user_id: user.id,
      p_address_id: addressId,
      p_idempotency_key: idempotencyKey,
      p_expected_total: expectedTotal
    }
  );
  if (!result.ok) return fail("ORDER_FAILED", void 0, 500);
  const data = result.data;
  if (data?.error) {
    const errCode = data.error;
    if (errCode === "ORDER_PRICE_CHANGED") {
      return fail("ORDER_PRICE_CHANGED", void 0, 409);
    }
    const codeMap = {
      ADDRESS_NOT_FOUND: "ORDER_ADDRESS_NOT_FOUND",
      CART_EMPTY: "ORDER_CART_EMPTY",
      PRODUCT_UNAVAILABLE: "INVENTORY_UNAVAILABLE",
      PRODUCT_NOT_PURCHASABLE: "INVENTORY_NOT_PURCHASABLE",
      OUT_OF_STOCK: "INVENTORY_OUT_OF_STOCK"
    };
    const mappedCode = codeMap[errCode] ?? errCode;
    const messageOverride = errCode === "OUT_OF_STOCK" ? `${data.name ?? "A product"} is out of stock (${data.stock ?? 0} remaining, ${data.requested ?? "?"} requested).` : void 0;
    const httpStatus = errCode === "OUT_OF_STOCK" || errCode === "PRODUCT_NOT_PURCHASABLE" ? 409 : 422;
    return fail(mappedCode, messageOverride, httpStatus);
  }
  return success({
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    total: data.total,
    subtotal: data.subtotal,
    discountTotal: data.discountTotal,
    shippingTotal: data.shippingTotal,
    idempotent: data.idempotent ?? false
  });
}
__name(handleCreateOrder, "handleCreateOrder");
async function handleCheckoutSummary(request, env) {
  const user = await requireAuth(env, request);
  if (!user) return fail("UNAUTHORIZED", void 0, 401);
  const result = await supabaseRestFetch(
    env,
    "GET",
    `/rest/v1/cart_items?user_id=eq.${encodeURIComponent(user.id)}&select=product_id,quantity,product:products!fk_cart_items_product_id(id,slug,name,price,compare_at,stock,is_preorder,is_active,visual_key,accent,sku)`
  );
  if (!result.ok) return fail("SUMMARY_FAILED", void 0, 500);
  const rows = result.data;
  if (!rows || rows.length === 0) {
    return success({ items: [], subtotal: 0, discountTotal: 0, shippingTotal: 0, total: 0, canCheckout: false });
  }
  const FREE_SHIPPING = 4990;
  const FLAT_SHIPPING = 149;
  const LOW_STOCK_THRESHOLD = 5;
  let subtotal = 0;
  let discountTotal = 0;
  const items = rows.map((row) => {
    const p = row.product;
    if (!p) return null;
    const unitPrice = p.price;
    const lineDiscount = p.compare_at && p.compare_at > p.price ? (p.compare_at - p.price) * row.quantity : 0;
    const lineTotal = unitPrice * row.quantity;
    subtotal += lineTotal;
    discountTotal += lineDiscount;
    let availability;
    if (!p.is_active) availability = "out-of-stock";
    else if (p.is_preorder) availability = "preorder";
    else if (p.stock === null || p.stock === 0) availability = "out-of-stock";
    else if (p.stock <= LOW_STOCK_THRESHOLD) availability = "low-stock";
    else availability = "in-stock";
    const purchasable = p.is_active && p.stock !== null && (p.is_preorder || p.stock >= row.quantity);
    return {
      productId: p.id,
      slug: p.slug,
      sku: p.sku,
      name: p.name,
      visualKey: p.visual_key,
      accent: p.accent,
      quantity: row.quantity,
      unitPrice,
      lineDiscount,
      lineTotal,
      availability,
      stock: p.stock,
      purchasable
    };
  }).filter(Boolean);
  const shippingTotal = subtotal - discountTotal >= FREE_SHIPPING ? 0 : FLAT_SHIPPING;
  const total = subtotal - discountTotal + shippingTotal;
  return success({
    items,
    subtotal,
    discountTotal,
    shippingTotal,
    total,
    canCheckout: items.length > 0 && items.every((i) => i.purchasable)
  });
}
__name(handleCheckoutSummary, "handleCheckoutSummary");

// src/orders/route.ts
async function orderRoutes(request, env, pathname, method) {
  if (pathname === "/orders" && method === "POST") return handleCreateOrder(request, env);
  if (pathname === "/orders/summary" && method === "GET") return handleCheckoutSummary(request, env);
  return null;
}
__name(orderRoutes, "orderRoutes");

// src/index.ts
var worker = {
  async fetch(request, env) {
    const resolvedEnv = resolveEnv(env);
    const url = new URL(request.url);
    const { method } = request;
    if (method === "OPTIONS") return corsPreflight();
    if (url.pathname === "/health" && method === "GET") {
      return new Response("ok", { status: 200 });
    }
    const authResponse = await registrationRoutes(request, resolvedEnv, url.pathname, method);
    if (authResponse) return authResponse;
    const orderResponse = await orderRoutes(request, resolvedEnv, url.pathname, method);
    if (orderResponse) return orderResponse;
    return fail("NOT_FOUND", void 0, 404);
  }
};
var src_default = worker;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-yNCPpu/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-yNCPpu/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker2) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker2;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker2.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker2.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker2,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker2.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker2.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
