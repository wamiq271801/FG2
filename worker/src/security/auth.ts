/**
 * Security — authentication helper — Phase 9
 *
 * Replaces the middleware/auth.ts pass-through.
 * requireAuth() verifies the Bearer JWT and returns the authenticated user,
 * or null if the token is missing or invalid.
 *
 * Callers must call this before any sensitive operation.
 */

import type { Env } from "../config/env";
import { verifyUser } from "../infrastructure/supabase";

export async function requireAuth(
  env: Env,
  request: Request
): Promise<{ id: string; email: string } | null> {
  return verifyUser(env, request);
}
