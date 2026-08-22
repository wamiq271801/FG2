/**
 * HTTP response helpers — Phase 9
 *
 * success() and fail() are the only two response constructors used by routes.
 * fail() delegates to workerError() from http/errors.ts so all error responses
 * share one shape and one source.
 */

import { workerError, type WorkerErrorCode } from "./errors";

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
    },
  });
}

export function success(data: unknown = null): Response {
  return json({ success: true, data }, 200);
}

/** Shorthand — delegates to the global error source. */
export function fail(code: WorkerErrorCode, message?: string, status = 422): Response {
  return workerError(code, message, status);
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-max-age": "86400",
    },
  });
}
