import { z } from "zod";

/**
 * Client-safe storefront notification event contract (FROZEN).
 *
 * The storefront owns the cache-invalidation system: the admin only emits
 * these domain events to POST /api/revalidate after a successful database
 * mutation. The admin never sends, knows, or displays cache tags —
 * events speak pure domain intent.
 *
 * This module is intentionally import-safe from client components (no
 * server-only guard): the shared banner encodes events for the retry form,
 * and pages decode the `evt` query parameter.
 */

export type StorefrontEvent =
  | { type: "product.created"; productId: string }
  | {
      type: "product.updated";
      productId: string;
      previousSlug?: string;
      previousCategoryId?: string;
    }
  | {
      type: "product.deleted";
      productId: string;
      slug?: string;
      previousCategoryId?: string;
    }
  | { type: "product.refresh"; productId: string }
  | { type: "category.created"; categoryId: string }
  | { type: "category.updated"; categoryId: string; previousSlug?: string }
  | { type: "category.deleted"; categoryId: string; slug?: string }
  | { type: "category.refresh"; categoryId: string }
  | { type: "review.approved"; productId: string }
  | { type: "review.rejected"; productId: string }
  | { type: "review.updated"; productId: string }
  | { type: "review.refresh"; productId?: string };

const id = z.uuid();

/** Strict validation of one decoded event — rejects anything unknown. */
export const storefrontEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("product.created"), productId: id }),
  z.strictObject({
    type: z.literal("product.updated"),
    productId: id,
    previousSlug: z.string().min(1).optional(),
    previousCategoryId: id.optional(),
  }),
  z.strictObject({
    type: z.literal("product.deleted"),
    productId: id,
    slug: z.string().min(1).optional(),
    previousCategoryId: id.optional(),
  }),
  z.strictObject({ type: z.literal("product.refresh"), productId: id }),
  z.strictObject({ type: z.literal("category.created"), categoryId: id }),
  z.strictObject({
    type: z.literal("category.updated"),
    categoryId: id,
    previousSlug: z.string().min(1).optional(),
  }),
  z.strictObject({
    type: z.literal("category.deleted"),
    categoryId: id,
    slug: z.string().min(1).optional(),
  }),
  z.strictObject({ type: z.literal("category.refresh"), categoryId: id }),
  z.strictObject({ type: z.literal("review.approved"), productId: id }),
  z.strictObject({ type: z.literal("review.rejected"), productId: id }),
  z.strictObject({ type: z.literal("review.updated"), productId: id }),
  z.strictObject({ type: z.literal("review.refresh"), productId: id.optional() }),
]);

// Compile-time guarantee that the schema and the hand-written type agree.
type _SchemaInferred = z.infer<typeof storefrontEventSchema>;
type _SchemaMatchesType = Exclude<_SchemaInferred, StorefrontEvent> extends never
  ? Exclude<StorefrontEvent, _SchemaInferred> extends never
    ? true
    : never
  : never;
const _schemaMatchesType: _SchemaMatchesType = true;
void _schemaMatchesType;

// ── Event codec (isomorphic base64url, safe in URLs and forms) ─────────
//
// btoa/atob/TextEncoder/TextDecoder exist both in Node (globals since
// Node 16/11) and in every browser, so the same code runs on the server
// (actions, pages) and in client components (the retry form).
//
// The URL-safe alphabet (- and _, no padding) means the encoded value
// survives query-string decoding unchanged — no "+"-becomes-space or
// percent-decoding hazards, whichever way the router normalises params.

function utf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(encoded: string): string | null {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/").trim();
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Encode an event for a hidden input or an `evt` query parameter. */
export function encodeEvent(event: StorefrontEvent): string {
  return utf8ToBase64Url(JSON.stringify(event));
}

/**
 * Decode + strictly validate an `evt` value. Returns null for anything
 * malformed, unknown, or extra-fielded — callers render nothing rather
 * than trusting attacker-supplied payloads.
 */
export function decodeEvent(raw: string | null | undefined): StorefrontEvent | null {
  if (!raw) return null;
  const json = base64UrlToUtf8(raw);
  if (json === null) return null;
  try {
    const parsed = storefrontEventSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ── Redirect-URL helpers (server actions) ───────────────────────────────

/**
 * Append the notify-failed markers to a redirect target.
 * `base` may already carry a query string (e.g. "/products?deleted=1").
 */
export function withNotifyFailed(
  base: string,
  event: StorefrontEvent,
  message: string
): string {
  const safeMessage = message.replace(/%/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}notifyFailed=1&evt=${encodeEvent(event)}&msg=${encodeURIComponent(safeMessage)}`;
}

/**
 * Read a notify-failure message back from a query parameter. The value is
 * plain ASCII by construction (see withNotifyFailed); the decode-then-
 * fallback keeps it correct whether or not the router already decoded it.
 */
export function readNotifyMessage(raw: string | null | undefined): string {
  if (!raw) return "the storefront could not be notified";
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.replace(/\s+/g, " ").trim().slice(0, 200) || "the storefront could not be notified";
  } catch {
    return raw.slice(0, 200);
  }
}
