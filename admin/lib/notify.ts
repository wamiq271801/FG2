import "server-only";

import {
  requireStorefrontRevalidateSecret,
  requireStorefrontRevalidateUrl,
} from "./env";
import type { StorefrontEvent } from "./notify-types";

export type { StorefrontEvent } from "./notify-types";

/**
 * Server-only storefront notifier (the admin's ONLY invalidation path).
 *
 * Contract (frozen — see docs/phase-2-architecture.md):
 *   POST <STOREFRONT_REVALIDATE_URL>
 *   Authorization: Bearer <STOREFRONT_REVALIDATE_SECRET>
 *   Content-Type: application/json
 *   body: one StorefrontEvent
 *   200 {"success":true} on success; 4xx/5xx {"success":false,"error"} on failure.
 *
 * Semantics mandated by the architecture:
 *   - exactly ONE attempt per call — no retries, no queues, no state
 *   - ~10s timeout via AbortController
 *   - ok ⇔ HTTP ok AND body.success === true
 *   - a failed notification NEVER rolls back the database mutation; the
 *     caller surfaces both facts (DB success + notification failure) and
 *     the operator may trigger one explicit new attempt later
 *   - the secret never appears in messages, logs, or URLs
 */

export type NotifyResult = { ok: true } | { ok: false; message: string };

const NOTIFY_TIMEOUT_MS = 10_000;

/** Short, human-readable, secret-free, URL-safe reason text. */
function cleanMessage(raw: string): string {
  const cleaned = raw
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/%/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return cleaned.length > 0 ? cleaned : "unknown error";
}

export async function notifyStorefront(event: StorefrontEvent): Promise<NotifyResult> {
  let secret: string;
  try {
    secret = requireStorefrontRevalidateSecret();
  } catch {
    return {
      ok: false,
      message: "storefront revalidation is not configured on the admin server",
    };
  }
  const url = requireStorefrontRevalidateUrl();

  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(
    () => controller.abort(),
    NOTIFY_TIMEOUT_MS
  );
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      signal: controller.signal,
      cache: "no-store",
    });

    let body: { success?: unknown; error?: unknown } | null = null;
    try {
      body = (await response.json()) as { success?: unknown; error?: unknown } | null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const reason =
        body && typeof body.error === "string" && body.error.length > 0
          ? cleanMessage(body.error)
          : `HTTP ${response.status}`;
      return { ok: false, message: `storefront rejected the notification (${reason})` };
    }
    if (!body || body.success !== true) {
      return { ok: false, message: "storefront returned an unexpected response" };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, message: "storefront notification timed out (10s)" };
    }
    const reason =
      error instanceof Error && error.message
        ? cleanMessage(error.message)
        : "network error";
    return { ok: false, message: `could not reach the storefront (${reason})` };
  } finally {
    clearTimeout(timer);
  }
}
