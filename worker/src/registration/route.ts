/**
 * Registration routes — Phase 9
 * Moved from routes/auth.ts.
 */

import type { Env } from "../config/env";
import {
  handleRegister,
  handleResendSignup,
  handleResetPassword,
} from "./service";

export async function registrationRoutes(
  request: Request,
  env: Env,
  pathname: string,
  method: string
): Promise<Response | null> {
  if (pathname === "/auth/register"       && method === "POST") return handleRegister(request, env);
  if (pathname === "/auth/resend-signup"  && method === "POST") return handleResendSignup(request, env);
  if (pathname === "/auth/reset-password" && method === "POST") return handleResetPassword(request, env);
  return null;
}
