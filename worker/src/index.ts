import { resolveEnv, type Env } from "./config/env";
import { corsPreflight, fail, json } from "./lib/response";
import { authRoutes } from "./routes/auth";
import { orderRoutes } from "./routes/orders";

const worker: { fetch(request: Request, env?: Env): Promise<Response> } = {
  async fetch(request: Request, env?: Env): Promise<Response> {
    const resolvedEnv = resolveEnv(env);
    const url = new URL(request.url);
    const { method } = request;

    if (method === "OPTIONS") return corsPreflight();

    if (url.pathname === "/health" && method === "GET") {
      return new Response("ok", { status: 200 });
    }

    const authResponse = await authRoutes(request, resolvedEnv, url.pathname, method);
    if (authResponse) return authResponse;

    const orderResponse = await orderRoutes(request, resolvedEnv, url.pathname, method);
    if (orderResponse) return orderResponse;

    return fail("NOT_FOUND", "Endpoint not found.", 404);
  },
};

export default worker;
