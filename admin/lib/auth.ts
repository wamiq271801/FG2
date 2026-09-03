import "server-only";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { requireAdminPassword, requireAdminSessionSecret } from "./env";

/**
 * Minimal private-tool access boundary (no RBAC, no multi-tenant auth):
 * one admin password from the git-ignored admin/.env.local, exchanged
 * for an HMAC-signed HttpOnly session cookie. The protected route group
 * verifies the cookie on every request server-side.
 */

const COOKIE_NAME = "fg_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(payload: string): string {
  return createHmac("sha256", requireAdminSessionSecret()).update(payload).digest("hex");
}

function verifyPassword(password: string): boolean {
  const expected = createHash("sha256").update(requireAdminPassword()).digest();
  const provided = createHash("sha256").update(password).digest();
  return timingSafeEqual(expected, provided);
}

/** Create the signed session cookie. Returns false on a wrong password. */
export async function login(password: string): Promise<boolean> {
  if (!verifyPassword(password)) return false;
  const payload = String(Date.now() + SESSION_TTL_MS);
  const store = await cookies();
  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return true;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** True when the request carries a valid, unexpired admin session. */
export async function hasAdminSession(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return false;
  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = sign(payload);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return false;
  }
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}
