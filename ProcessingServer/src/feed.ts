/**
 * Fusion Gadgets — ProcessingServer feed generation (pure logic).
 *
 * Builds the complete global homepage feed snapshot in memory from two
 * inputs:
 *
 *   product_metrics — TiDB's durable cumulative engagement/exposure state
 *   catalog         — the product eligibility facts from Supabase
 *                     (is_active, stock, added_at, price, compare_at_price)
 *
 * ONE feed snapshot, four sections, product UUIDs only, strict
 * active + stock eligibility, no filler, no random selection:
 *
 *   most_popular — genuinely popular: eligible products with V1
 *                  engagement score > 0, ranked by score DESC.
 *   new_arrivals — genuinely recent: eligible products by added_at DESC.
 *   on_sale      — genuinely discounted: eligible products with
 *                  compare_at_price > price, ranked by discount DESC.
 *   explore_more — discovery: eligible products NOT already used by a
 *                  stronger section, ranked by cumulative impressions ASC
 *                  (untested/underexposed first), score DESC as the
 *                  tie-break (promising-but-underexposed ahead of weak),
 *                  id ASC for full determinism.
 *
 * Cross-section dedup: sections are built in the priority order
 * most_popular → new_arrivals → on_sale → explore_more with a used-id set,
 * so one product appears at most once per snapshot (sections may publish
 * fewer products rather than fill with duplicates or filler).
 */

/** Durable cumulative per-product state (TiDB product_metrics row). */
export type ProductMetric = {
  product_id: string;
  views: number;
  impressions: number;
  clicks: number;
  cart_adds: number;
  wishlist_adds: number;
};

/** Per-batch event deltas for one product (from the aggregate step). */
export type ProductDelta = {
  views: number;
  impressions: number;
  clicks: number;
  cart_adds: number;
  wishlist_adds: number;
};

/** Catalog eligibility facts for one product (Supabase products row). */
export type CatalogRow = {
  id: string;
  is_active: boolean;
  stock: number;
  added_at: string;
  price: number;
  compare_at_price: number | null;
};

/** The published feed snapshot shape — ordered product-UUID arrays. */
export type HomeFeedSnapshot = {
  most_popular: string[];
  new_arrivals: string[];
  explore_more: string[];
  on_sale: string[];
};

/** Products per section in the published snapshot. */
export const SECTION_SIZE = 4;

/** V1 popularity score: views*1 + clicks*3 + cart_adds*5 + wishlist_adds*2. */
export function popularityScore(m: {
  views: number;
  clicks: number;
  cart_adds: number;
  wishlist_adds: number;
}): number {
  return m.views * 1 + m.clicks * 3 + m.cart_adds * 5 + m.wishlist_adds * 2;
}

/** Common eligibility rule for EVERY section: active AND in stock. */
export function isEligible(p: CatalogRow): boolean {
  return p.is_active && p.stock > 0;
}

/**
 * Merge the durable metrics with this batch's deltas — the post-batch
 * metric state the feed is generated from (the deltas are persisted to
 * product_metrics only after the feed is published, in the same
 * transaction that advances the checkpoint).
 */
export function mergedMetrics(
  durable: ProductMetric[],
  deltas: Map<string, ProductDelta>
): Map<string, ProductMetric> {
  const merged = new Map<string, ProductMetric>();
  for (const m of durable) {
    merged.set(m.product_id, { ...m });
  }
  for (const [id, d] of deltas) {
    const m = merged.get(id) ?? {
      product_id: id,
      views: 0,
      impressions: 0,
      clicks: 0,
      cart_adds: 0,
      wishlist_adds: 0,
    };
    m.views += d.views;
    m.impressions += d.impressions;
    m.clicks += d.clicks;
    m.cart_adds += d.cart_adds;
    m.wishlist_adds += d.wishlist_adds;
    merged.set(id, m);
  }
  return merged;
}

function discountFraction(p: CatalogRow): number {
  if (p.compare_at_price === null || p.compare_at_price <= p.price) return -1;
  return (p.compare_at_price - p.price) / p.compare_at_price;
}

/**
 * Build the complete feed snapshot. Pure and deterministic: same inputs →
 * byte-identical output (id ASC tie-breaks everywhere).
 */
export function selectFeed(
  metrics: Map<string, ProductMetric>,
  catalog: CatalogRow[],
  sectionSize: number = SECTION_SIZE
): HomeFeedSnapshot {
  const eligible = catalog.filter(isEligible);
  const metricOf = (id: string): ProductMetric | undefined => metrics.get(id);
  const scoreOf = (id: string): number => {
    const m = metricOf(id);
    return m ? popularityScore(m) : 0;
  };
  const impressionsOf = (id: string): number => metricOf(id)?.impressions ?? 0;

  // Selection priority: most_popular → new_arrivals → on_sale →
  // explore_more. A product already used by a stronger section never
  // consumes another section's slot.
  const used = new Set<string>();
  const take = (ids: string[]): string[] => {
    const out: string[] = [];
    for (const id of ids) {
      if (used.has(id)) continue;
      used.add(id);
      out.push(id);
      if (out.length >= sectionSize) break;
    }
    return out;
  };
  const byIdDesc = (a: string, b: string) => a.localeCompare(b);

  // 1. Most Popular — only products with genuine engagement (score > 0).
  const popular = eligible
    .filter((p) => scoreOf(p.id) > 0)
    .sort((a, b) => scoreOf(b.id) - scoreOf(a.id) || byIdDesc(a.id, b.id))
    .map((p) => p.id);
  const most_popular = take(popular);

  // 2. New Arrivals — genuinely recent additions.
  const fresh = [...eligible]
    .sort(
      (a, b) =>
        b.added_at.localeCompare(a.added_at) || byIdDesc(a.id, b.id)
    )
    .map((p) => p.id);
  const new_arrivals = take(fresh);

  // 3. On Sale — genuine discounts only, deepest discount first.
  const sale = eligible
    .filter((p) => p.compare_at_price !== null && p.compare_at_price > p.price)
    .sort((a, b) => discountFraction(b) - discountFraction(a) || byIdDesc(a.id, b.id))
    .map((p) => p.id);
  const on_sale = take(sale);

  // 4. Explore more — discovery for the underexposed: lowest cumulative
  // impressions first (the exposure loop: once shown, impressions grow and
  // the product naturally rotates out), score as the tie-break.
  const discovery = eligible
    .filter((p) => !used.has(p.id))
    .sort(
      (a, b) =>
        impressionsOf(a.id) - impressionsOf(b.id) ||
        scoreOf(b.id) - scoreOf(a.id) ||
        byIdDesc(a.id, b.id)
    )
    .map((p) => p.id);
  const explore_more = take(discovery);

  return { most_popular, new_arrivals, explore_more, on_sale };
}

/**
 * Structural equality of two feed snapshots (ordered arrays compared
 * element-wise — JSONB key order is not preserved by Postgres). Used for
 * the no-op publication check.
 */
export function sameFeed(a: HomeFeedSnapshot, b: HomeFeedSnapshot): boolean {
  const keys: (keyof HomeFeedSnapshot)[] = [
    "most_popular",
    "new_arrivals",
    "explore_more",
    "on_sale",
  ];
  for (const k of keys) {
    if (a[k].length !== b[k].length) return false;
    for (let i = 0; i < a[k].length; i++) {
      if (a[k][i] !== b[k][i]) return false;
    }
  }
  return true;
}

/**
 * Parse a stored home_feed.feed JSON value defensively. Returns null when
 * the shape is not a valid feed snapshot (corrupt/foreign data → treated
 * as "must publish a fresh feed").
 */
export function parseFeed(value: unknown): HomeFeedSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const section = (key: string): string[] | null => {
    const arr = v[key];
    if (!Array.isArray(arr)) return null;
    if (!arr.every((x) => typeof x === "string")) return null;
    return arr;
  };
  const most_popular = section("most_popular");
  const new_arrivals = section("new_arrivals");
  const explore_more = section("explore_more");
  const on_sale = section("on_sale");
  if (!most_popular || !new_arrivals || !explore_more || !on_sale) return null;
  return { most_popular, new_arrivals, explore_more, on_sale };
}
