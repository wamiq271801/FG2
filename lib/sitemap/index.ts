/**
 * Centralized sitemap composition layer (pure transforms + configuration).
 *
 * Data access stays in the existing catalog modules
 * (modules/catalog/products.ts, modules/catalog/categories.ts); this
 * barrel only re-exports the composition helpers for the sitemap route
 * handlers.
 */

export * from "./config";
export * from "./static";
export * from "./xml";
export * from "./products";
export * from "./categories";
