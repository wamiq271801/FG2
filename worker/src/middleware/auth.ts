import type { Env } from "../config/env";
import { verifyUser } from "../lib/supabase";

export async function requireAuth(env: Env, request: Request): Promise<{ id: string; email: string } | null> {
  return verifyUser(env, request);
}
