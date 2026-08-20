var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/config/env.ts
var SUPABASE_URL = "https://onyzjnitnekjhdexecdm.supabase.co";
var SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXpqbml0bmVramhkZXhlY2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzAzNzY1NSwiZXhwIjoyMTAyNjEzNjU1fQ.XcDlBReiaBQRg7xcftYqu5wMFG9zQhPTYvetc6G4Exk";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXpqbml0bmVramhkZXhlY2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMzc2NTUsImV4cCI6MjEwMjYxMzY1NX0.GqXaLdE4txXx5cooRRc4TS01OfjVzP4Sq8MxfpGY-HA";
var TURNSTILE_SECRET_KEY_DEFAULT = "0x4AAAAAAEWdqp_RFhs9JjaawIIwjxLn4lM";
var TURNSTILE_EXPECTED_HOSTNAME_DEFAULT = "";
var SIGNUP_AUTHZ_TTL_SECONDS_DEFAULT = 5 * 60;
function resolveEnv(env) {
  const turnstileSecret = env?.TURNSTILE_SECRET_KEY || TURNSTILE_SECRET_KEY_DEFAULT;
  if (!turnstileSecret) {
    throw new Error("TURNSTILE_SECRET_KEY is not configured on the Worker.");
  }
  return {
    SUPABASE_URL: env?.SUPABASE_URL || SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env?.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: env?.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
    TURNSTILE_SECRET_KEY: turnstileSecret,
    TURNSTILE_EXPECTED_HOSTNAME: (env?.TURNSTILE_EXPECTED_HOSTNAME || TURNSTILE_EXPECTED_HOSTNAME_DEFAULT).trim(),
    SIGNUP_AUTHZ_TTL_SECONDS: env?.SIGNUP_AUTHZ_TTL_SECONDS ? Number(env.SIGNUP_AUTHZ_TTL_SECONDS) : SIGNUP_AUTHZ_TTL_SECONDS_DEFAULT
  };
}
__name(resolveEnv, "resolveEnv");

// src/lib/response.ts
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
  return json({ success: false, error: { code, message } }, status);
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

// src/lib/supabase.ts
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
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json"
  };
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : void 0
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
}
__name(supabaseRestFetch, "supabaseRestFetch");
async function verifyUser(env, request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.id || !data?.email) return null;
  return { id: data.id, email: data.email };
}
__name(verifyUser, "verifyUser");

// src/lib/validation.ts
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email) {
  return EMAIL_RE.test(email);
}
__name(isValidEmail, "isValidEmail");
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
__name(normalizeEmail, "normalizeEmail");
function validateRegistration(body) {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body." };
  const b = body;
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  const password = typeof b.password === "string" ? b.password : "";
  const turnstileToken = typeof b.turnstileToken === "string" ? b.turnstileToken.trim() : "";
  if (fullName.length < 2) return { ok: false, error: "Please enter your name (2+ characters)." };
  if (fullName.length > 100) return { ok: false, error: "Name is too long." };
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (password.length > 72) return { ok: false, error: "Password is too long (max 72)." };
  if (!turnstileToken) return { ok: false, error: "Verification failed. Please try again." };
  return { ok: true, data: { fullName, email, password, turnstileToken } };
}
__name(validateRegistration, "validateRegistration");
function validateEmailOnly(body) {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body." };
  const b = body;
  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  return { ok: true, data: { email } };
}
__name(validateEmailOnly, "validateEmailOnly");
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

// src/middleware/rate-limit.ts
async function checkRateLimit(env, key, max, windowSeconds) {
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/rpc/check_rate_limit",
    { p_key: key, p_max: max, p_window_seconds: windowSeconds }
  );
  return result.ok && result.data === true;
}
__name(checkRateLimit, "checkRateLimit");
function clientIp(request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
__name(clientIp, "clientIp");

// src/lib/turnstile.ts
var SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
var TURNSTILE_ACTION = "signup";
var REQUEST_TIMEOUT_MS = 8e3;
async function verifyTurnstile(env, token, remoteIp) {
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
    if (!data) return false;
    if (!data.success) return false;
    if (data.action !== void 0 && data.action !== TURNSTILE_ACTION) {
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
__name(verifyTurnstile, "verifyTurnstile");

// src/lib/signup-auth.ts
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
function normalizeEmail2(email) {
  return email.trim().toLowerCase();
}
__name(normalizeEmail2, "normalizeEmail");
async function emailHash(email) {
  return sha256Hex(normalizeEmail2(email));
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
  const now = Date.now();
  const expiresAt = new Date(now + ttlSeconds * 1e3).toISOString();
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/signup_authorizations",
    {
      token_hash: tokenHash,
      email_hash: emailHashValue,
      expires_at: expiresAt
      // created_at + consumed_at default to now() / NULL server-side.
    }
  );
  return result.ok && (result.status === 201 || result.status === 200);
}
__name(createSignupAuthorization, "createSignupAuthorization");

// src/services/auth.service.ts
async function handleRegister(request, env) {
  const ip = clientIp(request);
  const ipAllowed = await checkRateLimit(env, `register:${ip}`, 5, 900);
  if (!ipAllowed) return fail("RATE_LIMITED", "Too many attempts. Please wait a few minutes.", 429);
  const body = await request.json().catch(() => null);
  const validation = validateRegistration(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);
  const { fullName, email, password, turnstileToken } = validation.data;
  const emailAllowed = await checkRateLimit(env, `register:${email}`, 3, 900);
  if (!emailAllowed) return fail("RATE_LIMITED", "Too many attempts. Please wait a few minutes.", 429);
  const turnstileOk = await verifyTurnstile(env, turnstileToken, ip);
  if (!turnstileOk) return fail("TURNSTILE_FAILED", "Verification failed. Please try again.", 422);
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
  const signup = await supabaseSignup(env, email, password, {
    full_name: fullName,
    reg_auth: token
  });
  if (!signup.ok) {
    const msg = typeof signup.body?.msg === "string" ? signup.body.msg : typeof signup.body?.message === "string" ? signup.body.message : "";
    if (/already registered|already exists/i.test(msg)) {
      return fail("EMAIL_EXISTS", "An account with this email already exists.", 409);
    }
    if (signup.status === 422 || /not authorized|session expired/i.test(msg)) {
      return fail("SIGNUP_REJECTED", "Registration could not be completed. Please try again.", 422);
    }
    return fail("SIGNUP_FAILED", "Unable to create account. Please try again.", 502);
  }
  return success();
}
__name(handleRegister, "handleRegister");
async function handleResendSignup(request, env) {
  const body = await request.json().catch(() => null);
  const validation = validateEmailOnly(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);
  const email = validation.data.email;
  const allowed = await checkRateLimit(env, `resend:${email}`, 3, 86400);
  if (!allowed) return fail("RATE_LIMITED", "Too many resend attempts for this email. Please try again tomorrow.", 429);
  const result = await supabaseAuthFetch(env, "/auth/v1/resend", {
    email,
    type: "signup"
  });
  if (!result.ok) {
    return fail("RESEND_FAILED", "Unable to send code. Please try again.", 429);
  }
  return success();
}
__name(handleResendSignup, "handleResendSignup");
async function handleResetPassword(request, env) {
  const ip = clientIp(request);
  const body = await request.json().catch(() => null);
  const validation = validateEmailOnly(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);
  const email = validation.data.email;
  const allowed = await checkRateLimit(env, `reset:${email}:${ip}`, 5, 900);
  if (!allowed) return fail("RATE_LIMITED", "Too many attempts. Please wait.", 429);
  await supabaseAuthFetch(env, "/auth/v1/recover", { email });
  return success();
}
__name(handleResetPassword, "handleResetPassword");

// src/routes/auth.ts
async function authRoutes(request, env, pathname, method) {
  if (pathname === "/auth/register" && method === "POST") return handleRegister(request, env);
  if (pathname === "/auth/resend-signup" && method === "POST") return handleResendSignup(request, env);
  if (pathname === "/auth/reset-password" && method === "POST") return handleResetPassword(request, env);
  return null;
}
__name(authRoutes, "authRoutes");

// src/middleware/auth.ts
async function requireAuth(env, request) {
  return verifyUser(env, request);
}
__name(requireAuth, "requireAuth");

// src/services/orders.service.ts
async function handleCreateOrder(request, env) {
  const user = await requireAuth(env, request);
  if (!user) return fail("UNAUTHORIZED", "Authentication required.", 401);
  const ip = clientIp(request);
  const allowed = await checkRateLimit(env, `orders:${user.id}`, 5, 900);
  if (!allowed) return fail("RATE_LIMITED", "Too many checkout attempts. Please wait.", 429);
  const body = await request.json().catch(() => null);
  const validation = validateOrderRequest(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);
  const { addressId, idempotencyKey } = validation.data;
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/rpc/create_order",
    {
      p_user_id: user.id,
      p_address_id: addressId,
      p_idempotency_key: idempotencyKey
    }
  );
  if (!result.ok) {
    return fail("ORDER_FAILED", "Unable to create order. Please try again.", 500);
  }
  const data = result.data;
  if (data?.error) {
    const errCode = data.error;
    const errMap = {
      ADDRESS_NOT_FOUND: { code: "ADDRESS_NOT_FOUND", message: "Selected address not found or not owned by you." },
      CART_EMPTY: { code: "CART_EMPTY", message: "Your cart is empty." },
      PRODUCT_UNAVAILABLE: { code: "PRODUCT_UNAVAILABLE", message: `Product "${data.slug}" is no longer available.` },
      OUT_OF_STOCK: { code: "OUT_OF_STOCK", message: `${data.name} is out of stock.` },
      VARIANT_UNAVAILABLE: { code: "VARIANT_UNAVAILABLE", message: `Variant for ${data.slug} is no longer available.` },
      VARIANT_OUT_OF_STOCK: { code: "VARIANT_OUT_OF_STOCK", message: `${data.name} (${data.variant}) is out of stock.` }
    };
    const err = errMap[errCode] ?? { code: "ORDER_FAILED", message: "Unable to create order." };
    return fail(err.code, err.message);
  }
  return success(data);
}
__name(handleCreateOrder, "handleCreateOrder");

// src/routes/orders.ts
async function orderRoutes(request, env, pathname, method) {
  if (pathname === "/orders" && method === "POST") return handleCreateOrder(request, env);
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
    const authResponse = await authRoutes(request, resolvedEnv, url.pathname, method);
    if (authResponse) return authResponse;
    const orderResponse = await orderRoutes(request, resolvedEnv, url.pathname, method);
    if (orderResponse) return orderResponse;
    return fail("NOT_FOUND", "Endpoint not found.", 404);
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

// .wrangler/tmp/bundle-5GX8oF/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-5GX8oF/middleware-loader.entry.ts
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
