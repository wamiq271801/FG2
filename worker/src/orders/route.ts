/**
 * Orders routes — Phase 9
 * Moved from routes/orders.ts.
 */

import type { Env } from "../config/env";
import { handleCreateOrder, handleCheckoutSummary } from "./service";

export async function orderRoutes(
  request: Request,
  env: Env,
  pathname: string,
  method: string
): Promise<Response | null> {
  if (pathname === "/orders"         && method === "POST") return handleCreateOrder(request, env);
  if (pathname === "/orders/summary" && method === "GET")  return handleCheckoutSummary(request, env);
  return null;
}
