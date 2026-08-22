/**
 * Registration — one-time signup authorization — Phase 9
 * Moved from lib/signup-auth.ts. No logic changes.
 *
 * Provides the canonical normalizeEmail() used across the Worker.
 * TASK 9.5: validation.ts had a duplicate normalizeEmail; that copy is removed.
 * All callers must import normalizeEmail from this module.
 *
 * Hashing must EXACTLY match the Supabase hook's digest() in
 * supabase/migrations/0005_signup_authorizations.sql:
 *   - email: lower(trim(email)) → SHA-256 → hex
 *   - token: raw token          → SHA-256 → hex
 */

import type { Env } from "../config/env";
import { supabaseRestFetch } from "../infrastructure/supabase";

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/** Canonical email normalisation — single source of truth in the Worker. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function emailHash(email: string): Promise<string> {
  return sha256Hex(normalizeEmail(email));
}

export function generateAuthorizationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSignupAuthorization(
  env: Env,
  tokenHash: string,
  emailHashValue: string,
  ttlSeconds: number
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/signup_authorizations",
    { token_hash: tokenHash, email_hash: emailHashValue, expires_at: expiresAt }
  );
  return result.ok && (result.status === 201 || result.status === 200);
}
