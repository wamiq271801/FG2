import type { Env } from "../config/env";
import { supabaseRestFetch } from "./supabase";

// Hashing must EXACTLY match the Supabase hook's digest() in
// supabase/migrations/0005_signup_authorizations.sql:
//   - email: lower(trim(email))  →  SHA-256  →  hex
//   - token: raw token            →  SHA-256  →  hex
// The raw authorization token is returned to the frontend and never stored.

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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function emailHash(email: string): Promise<string> {
  return sha256Hex(normalizeEmail(email));
}

// Generate a cryptographically secure one-time authorization token.
// 32 bytes (256 bits) of entropy, URL-safe base64.
export function generateAuthorizationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Insert an unused, short-lived authorization record via the Supabase REST API
// (service_role bypasses RLS). Returns true on success.
export async function createSignupAuthorization(
  env: Env,
  tokenHash: string,
  emailHashValue: string,
  ttlSeconds: number
): Promise<boolean> {
  const now = Date.now();
  const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();

  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/signup_authorizations",
    {
      token_hash: tokenHash,
      email_hash: emailHashValue,
      expires_at: expiresAt,
      // created_at + consumed_at default to now() / NULL server-side.
    }
  );

  // Supabase returns 201 Created on successful insert with Prefer=return=representation
  // (default returns empty body but res.ok = true).
  return result.ok && (result.status === 201 || result.status === 200);
}
