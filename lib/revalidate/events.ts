/**
 * Storefront cache-invalidation event contract (FROZEN — Phase 2).
 *
 * The storefront owns the cache-invalidation system: the admin emits these
 * domain events to POST /api/revalidate after a successful database
 * mutation. The admin never sends, knows, or displays cache tags — events
 * speak pure domain intent, and this schema mirrors the admin-side
 * contract (admin/lib/notify-types.ts) byte-for-byte.
 */

import { z } from "zod";

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

/** Strict validation of one event — rejects anything unknown. */
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
