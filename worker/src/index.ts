/**
 * Worker entry point — Phase 9
 *
 * Imports updated to the responsibility-based directory structure.
 * Old flat lib/, middleware/, routes/, services/ directories are removed.
 */

import { resolveEnv, type Env } from "./config/env";
import { corsPreflight, fail } from "./http/response";
import { registrationRoutes } from "./registration/route";
import { orderRoutes } from "./orders/route";

const worker: { fetch(request: Request, env?: Env): Promise<Response> } = {
  async fetch(request: Request, env?: Env): Promise<Response> {
    const resolvedEnv = resolveEnv(env);
    const url = new URL(request.url);
    const { method } = request;

    if (method === "OPTIONS") return corsPreflight();

    if (url.pathname === "/health" && method === "GET") {
      return new Response("ok", { status: 200 });
    }

    const authResponse = await registrationRoutes(request, resolvedEnv, url.pathname, method);
    if (authResponse) return authResponse;

    const orderResponse = await orderRoutes(request, resolvedEnv, url.pathname, method);
    if (orderResponse) return orderResponse;

    return fail("NOT_FOUND", undefined, 404);
  },
};

export default worker;
