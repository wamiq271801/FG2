/**
 * Home feed — the storefront's server-side consumer of the global feed
 * snapshot published by the ProcessingServer.
 *
 * Architecture (docs/phase-2-architecture.md, "Cache boundaries"):
 *
 *   Supabase home_feed (singleton, product UUID arrays only)
 *       → getHomeFeedIds()   [the ONE cached feed scope, tagged feed:home]
 *       → getHomeFeed()      [per-request assembly]
 *           . resolve ids against the authoritative product-card dataset
 *           . ONE live batched stock overlay (the runtime safety layer)
 *           . return the four sections in feed display order
 *
 * The feed stores WHAT products should appear; the products table (via
 * getAllProductCards) remains the source of truth for WHAT those products
 * currently are — price/name/image changes invalidate the card dataset,
 * never the feed, and a feed publication invalidates feed:home, never the
 * product scopes.
 *
 * There is NO fallback: an empty (or not-yet-published) feed is a valid
 * pipeline state — the homepage simply renders without product-feed
 * sections. A missing home_feed TABLE is likewise a deployment state
 * (the migration is not yet applied) and reads as an empty feed.
 */

import { cacheLife, cacheTag } from "next/cache";
import { createCatalogClient } from "@/lib/supabase/catalog";
import { getAllProductCards } from "./products";
import { getStocks, overlayStock } from "./stock";
import type { Product } from "@/types";

/** The published snapshot's four sections, as ordered product-id arrays. */
export type HomeFeedIds = {
  mostPopular: string[];
  newArrivals: string[];
  exploreMore: string[];
  onSale: string[];
};

/** The rendered feed: the four sections resolved to live product data. */
export type HomeFeed = {
  mostPopular: Product[];
  newArrivals: Product[];
  exploreMore: Product[];
  onSale: Product[];
};

const EMPTY_FEED: HomeFeedIds = {
  mostPopular: [],
  newArrivals: [],
  exploreMore: [],
  onSale: [],
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse and validate the stored feed JSONB: an object whose four section
 * keys are each arrays of UUID strings. Invalid shapes read as an empty
 * feed (a visible pipeline state — never a fallback selection).
 */
function parseFeedJson(value: unknown): HomeFeedIds {
  if (typeof value !== "object" || value === null) return EMPTY_FEED;
  const v = value as Record<string, unknown>;
  const section = (key: string): string[] => {
    const arr = v[key];
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string" && UUID_RE.test(x));
  };
  return {
    mostPopular: section("most_popular"),
    newArrivals: section("new_arrivals"),
    exploreMore: section("explore_more"),
    onSale: section("on_sale"),
  };
}

/**
 * The home-feed cache scope: the singleton's product-id arrays ONLY.
 *
 * The ONLY tag is `feed:home` — resolved exclusively by the storefront's
 * feed.published domain event. Product/category events never drop it, and
 * feed publication never drops product scopes.
 */
export async function getHomeFeedIds(): Promise<HomeFeedIds> {
  "use cache";
  cacheLife("indefinite");
  cacheTag("feed:home");

  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("home_feed")
    .select("feed")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    // The home_feed table not existing yet is a deployment state (the
    // migration has not been applied) — an empty feed, not a failure.
    if (error.code === "PGRST205") return EMPTY_FEED;
    throw error;
  }
  if (!data) return EMPTY_FEED;
  return parseFeedJson((data as { feed: unknown }).feed);
}

/**
 * The authoritative homepage feed loader:
 *
 *   1. read the singleton home_feed (cached id scope, feed:home-tagged)
 *   2. validate/parse its JSON structure
 *   3. obtain the product UUID arrays
 *   4. resolve current product data from the authoritative card dataset
 *      (feed order preserved; missing/inactive ids drop out)
 *   5. apply the existing live stock safety overlay
 *   6. return the four sections
 */
export async function getHomeFeed(): Promise<HomeFeed> {
  const [ids, dataset] = await Promise.all([
    getHomeFeedIds(),
    getAllProductCards(),
  ]);
  const byId = new Map(dataset.map((p) => [p.id, p]));

  const allIds = [
    ...new Set([
      ...ids.mostPopular,
      ...ids.newArrivals,
      ...ids.exploreMore,
      ...ids.onSale,
    ]),
  ];
  const stockMap = await getStocks(allIds);

  const resolve = (feedIds: string[]): Product[] =>
    overlayStock(
      feedIds
        .map((id) => byId.get(id))
        .filter((p): p is Product => Boolean(p)),
      stockMap
    );

  return {
    mostPopular: resolve(ids.mostPopular),
    newArrivals: resolve(ids.newArrivals),
    exploreMore: resolve(ids.exploreMore),
    onSale: resolve(ids.onSale),
  };
}
