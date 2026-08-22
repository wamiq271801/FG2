/**
 * Registration — input validation — Phase 9
 *
 * Contains only registration-specific validation.
 * normalizeEmail is imported from registration/authorization.ts (canonical source).
 * validateOrderRequest and validateCartQuantity live in orders/validation.ts.
 */

import { normalizeEmail } from "./authorization";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PW_UPPERCASE_RE = /[A-Z]/;
const PW_NUMBER_RE = /[0-9]/;
const PW_SPECIAL_RE = /[^A-Za-z0-9]/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function validatePassword(
  password: string
): { ok: true } | { ok: false; error: string } {
  if (password.length < 8)  return { ok: false, error: "Password must be at least 8 characters." };
  if (password.length > 72) return { ok: false, error: "Password is too long (max 72)." };
  if (!PW_UPPERCASE_RE.test(password)) return { ok: false, error: "Password must include at least one uppercase letter." };
  if (!PW_NUMBER_RE.test(password))    return { ok: false, error: "Password must include at least one number." };
  if (!PW_SPECIAL_RE.test(password))   return { ok: false, error: "Password must include at least one special character." };
  return { ok: true };
}

export function validateRegistration(body: unknown): {
  ok: true;
  data: { email: string; password: string; turnstileToken: string };
} | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body." };
  const b = body as Record<string, unknown>;
  const email          = typeof b.email          === "string" ? normalizeEmail(b.email) : "";
  const password       = typeof b.password       === "string" ? b.password : "";
  const turnstileToken = typeof b.turnstileToken  === "string" ? b.turnstileToken.trim() : "";

  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) return { ok: false, error: pwCheck.error };
  if (!turnstileToken)      return { ok: false, error: "Verification failed. Please try again." };
  return { ok: true, data: { email, password, turnstileToken } };
}

export function validateEmailOnly(body: unknown): {
  ok: true;
  data: { email: string };
} | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body." };
  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  return { ok: true, data: { email } };
}
