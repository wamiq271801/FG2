import type { Env } from "../config/env";
import { handleCreateOrder } from "../services/orders.service";

export async function orderRoutes(request: Request, env: Env, pathname: string, method: string): Promise<Response | null> {
  if (pathname === "/orders" && method === "POST") return handleCreateOrder(request, env);
  return null;
}
