const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateRegistration(body: unknown): { ok: true; data: { email: string; password: string; turnstileToken: string } } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body." };
  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  const password = typeof b.password === "string" ? b.password : "";
  const turnstileToken = typeof b.turnstileToken === "string" ? b.turnstileToken.trim() : "";

  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (password.length > 72) return { ok: false, error: "Password is too long (max 72)." };
  if (!turnstileToken) return { ok: false, error: "Verification failed. Please try again." };
  return { ok: true, data: { email, password, turnstileToken } };
}

export function validateEmailOnly(body: unknown): { ok: true; data: { email: string } } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body." };
  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? normalizeEmail(b.email) : "";
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  return { ok: true, data: { email } };
}

export function validateOrderRequest(body: unknown): { ok: true; data: { addressId: string; idempotencyKey: string } } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request." };
  const b = body as Record<string, unknown>;
  const addressId = typeof b.addressId === "string" ? b.addressId.trim() : "";
  const idempotencyKey = typeof b.idempotencyKey === "string" ? b.idempotencyKey.trim() : "";
  if (!addressId) return { ok: false, error: "A delivery address is required." };
  if (!idempotencyKey || idempotencyKey.length > 100) return { ok: false, error: "Invalid checkout request." };
  return { ok: true, data: { addressId, idempotencyKey } };
}
