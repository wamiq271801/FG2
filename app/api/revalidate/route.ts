/**
 * POST /api/revalidate — the storefront's cache-invalidation endpoint.
 *
 * The ONE entry point of the Phase 2 invalidation system. The admin
 * notifies this endpoint after every successful database mutation (and
 * for manual refresh / operator retries) with a frozen-contract domain
 * event. The endpoint:
 *
 *   1. Authenticates: `Authorization: Bearer <REVALIDATE_SECRET>`
 *      (timing-safe compare; the secret lives only in server env files).
 *   2. Validates the event body strictly (zod) — no arbitrary tags are
 *      ever accepted.
 *   3. Resolves the affected cache tags via the storefront-owned policy
 *      (lib/revalidate/resolve-tags.ts), querying its own database where
 *      needed (e.g. a product's current slug).
 *   4. Calls revalidateTag(tag) for each resolved tag.
 *   5. Responds `{ success: true }` or `{ success: false, error }` — no
 *      tags or internals leaked.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { storefrontEventSchema } from "@/lib/revalidate/events";
import { resolveEventTags } from "@/lib/revalidate/resolve-tags";

function denied(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Timing-safe bearer-token comparison. Both sides are SHA-256-digested
 * first so the comparison always runs over equal-length buffers and the
 * provided token's length never leaks.
 */
function bearerMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  // 1. Authenticate.
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.error("[api/revalidate] REVALIDATE_SECRET is not configured");
    return denied("revalidation is not configured", 500);
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  if (!token || !bearerMatches(token, secret)) {
    return denied("unauthorized", 401);
  }

  // 2. Validate the event strictly.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return denied("invalid event body", 400);
  }
  const parsed = storefrontEventSchema.safeParse(body);
  if (!parsed.success) {
    return denied("invalid event", 400);
  }

  // 3. Resolve affected tags via the storefront-owned policy.
  let tags: string[];
  try {
    tags = await resolveEventTags(parsed.data);
  } catch (error) {
    console.error("[api/revalidate] tag resolution failed", error);
    return denied("revalidation failed", 500);
  }

  // 4. Drop the entries. The "max" profile purges the tag across every
  // cache layer (server entries + client router caches) — the full drop
  // the Phase 2 freshness model requires.
  try {
    for (const tag of tags) {
      revalidateTag(tag, "max");
    }
  } catch (error) {
    console.error("[api/revalidate] revalidateTag failed", error);
    return denied("revalidation failed", 500);
  }

  // 5. Done — no tags or internals leaked.
  return NextResponse.json({ success: true });
}
