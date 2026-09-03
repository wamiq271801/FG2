/**
 * Storefront-owned invalidation policy — docs/phase-2-architecture.md
 * ("Invalidation policy").
 *
 * Resolves one admin domain event to the set of cache tags to drop. The
 * storefront may query its own database to resolve the current slug of a
 * product/category; the admin never learns the tag topology.
 *
 * Feed independence guarantees: `feed:home` appears in NO product or
 * category event's tag list; product data tags appear in no feed event.
 * Offers scopes are tagged for future use — no offer mutation path exists
 * in this phase, so no event resolves offer tags.
 */

import { createCatalogClient } from "@/lib/supabase/catalog";
import type { StorefrontEvent } from "./events";

async function productSlugById(productId: string): Promise<string | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  return (data as { slug?: string } | null)?.slug ?? undefined;
}

async function categorySlugById(categoryId: string): Promise<string | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw error;
  return (data as { slug?: string } | null)?.slug ?? undefined;
}

/**
 * Resolve the cache tags for one event.
 *
 * Tag vocabulary (the only tags this endpoint ever emits):
 *   product:{id}, product-slug:{slug}, products,
 *   category:{id}, category-slug:{slug}, categories,
 *   reviews, reviews:{productId},
 *   sitemap:products, sitemap:categories
 */
export async function resolveEventTags(event: StorefrontEvent): Promise<string[]> {
  switch (event.type) {
    case "product.created":
    case "product.updated":
    case "product.refresh": {
      // Slug resolution is best-effort: the row may already be gone
      // (archived/deleted concurrently) — the id-level tags still drop
      // every entry that matters.
      let currentSlug: string | undefined;
      try {
        currentSlug = await productSlugById(event.productId);
      } catch {
        currentSlug = undefined;
      }
      const tags = new Set<string>([
        `product:${event.productId}`,
        "products",
        "sitemap:products",
      ]);
      if (currentSlug) tags.add(`product-slug:${currentSlug}`);
      if (event.type === "product.updated" && event.previousSlug) {
        tags.add(`product-slug:${event.previousSlug}`);
      }
      return [...tags];
    }

    case "product.deleted": {
      // The row is gone — the event's slug (captured pre-delete by the
      // admin) is the only slug source.
      const tags = new Set<string>([
        `product:${event.productId}`,
        "products",
        "sitemap:products",
      ]);
      if (event.slug) tags.add(`product-slug:${event.slug}`);
      return [...tags];
    }

    case "category.created":
    case "category.updated":
    case "category.refresh": {
      let currentSlug: string | undefined;
      try {
        currentSlug = await categorySlugById(event.categoryId);
      } catch {
        currentSlug = undefined;
      }
      const tags = new Set<string>([
        "categories",
        `category:${event.categoryId}`,
        "sitemap:categories",
      ]);
      if (currentSlug) tags.add(`category-slug:${currentSlug}`);
      if (event.type === "category.updated" && event.previousSlug) {
        tags.add(`category-slug:${event.previousSlug}`);
      }
      return [...tags];
    }

    case "category.deleted": {
      const tags = new Set<string>([
        "categories",
        `category:${event.categoryId}`,
        "sitemap:categories",
      ]);
      if (event.slug) tags.add(`category-slug:${event.slug}`);
      return [...tags];
    }

    case "review.approved":
    case "review.rejected":
    case "review.updated":
      return [`reviews:${event.productId}`, "reviews"];

    case "review.refresh":
      // No productId = the whole review domain.
      return event.productId ? [`reviews:${event.productId}`, "reviews"] : ["reviews"];
  }
}
