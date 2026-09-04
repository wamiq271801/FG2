/**
 * Feed generation tests — the pure selection logic in feed.ts.
 *
 * Covers the spec's behavioral requirements: eligibility (active/stock),
 * genuine popularity, genuine recency, genuine discounts, exposure-based
 * discovery, cross-section dedup, no filler, determinism, and the no-op
 * comparison.
 *
 * NOTE on test construction: sections claim products in the fixed priority
 * most_popular → new_arrivals → on_sale → explore_more with a used-id set.
 * Tests that isolate a LATER section first saturate the EARLIER sections
 * with newest-eligibility "absorber" products (added_at DESC fills
 * new_arrivals' 4 slots) so the products under test survive to the
 * section being asserted.
 *
 * Run: bun test (from ProcessingServer/)
 */
import { describe, expect, test } from "bun:test";
import {
  isEligible,
  mergedMetrics,
  parseFeed,
  popularityScore,
  sameFeed,
  selectFeed,
  type CatalogRow,
  type ProductDelta,
  type ProductMetric,
} from "./feed";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";
const UUID_C = "33333333-3333-3333-3333-333333333333";
const UUID_D = "44444444-4444-4444-4444-444444444444";
const UUID_E = "55555555-5555-5555-5555-555555555555";
const UUID_F = "66666666-6666-6666-6666-666666666666";
const UUID_G = "77777777-7777-7777-7777-777777777777";

function catalogRow(
  id: string,
  over: Partial<CatalogRow> = {}
): CatalogRow {
  return {
    id,
    is_active: true,
    stock: 5,
    added_at: "2026-08-01",
    price: 100,
    compare_at_price: null,
    ...over,
  };
}

function metric(
  product_id: string,
  over: Partial<ProductMetric> = {}
): ProductMetric {
  return {
    product_id,
    views: 0,
    impressions: 0,
    clicks: 0,
    cart_adds: 0,
    wishlist_adds: 0,
    ...over,
  };
}

/** A complete per-product delta. */
function delta(over: Partial<ProductDelta> = {}): ProductDelta {
  return { views: 0, impressions: 0, clicks: 0, cart_adds: 0, wishlist_adds: 0, ...over };
}

/** Map of product_id → metric (selectFeed's input shape). */
function metricsMap(...rows: ProductMetric[]): Map<string, ProductMetric> {
  return new Map(rows.map((m) => [m.product_id, m]));
}

/**
 * Four NEWEST eligible no-metric no-discount products (added_at DESC beyond
 * everything else in the test) — they saturate new_arrivals so later
 * sections' candidates survive. Sorted newest→oldest: G, F, E, D.
 */
function newArrivalsAbsorbers(): CatalogRow[] {
  return [
    catalogRow(UUID_G, { added_at: "2026-09-04" }),
    catalogRow(UUID_F, { added_at: "2026-09-03" }),
    catalogRow(UUID_E, { added_at: "2026-09-02" }),
    catalogRow(UUID_D, { added_at: "2026-09-01" }),
  ];
}

describe("eligibility — active AND stock > 0", () => {
  test("active + stock > 0 → eligible", () => {
    expect(isEligible(catalogRow(UUID_A))).toBe(true);
  });

  test("stock = 0 → ineligible", () => {
    expect(isEligible(catalogRow(UUID_A, { stock: 0 }))).toBe(false);
  });

  test("inactive → ineligible (even with stock)", () => {
    expect(isEligible(catalogRow(UUID_A, { is_active: false }))).toBe(false);
  });

  test("out-of-stock product appears in NO section", () => {
    const feed = selectFeed(
      metricsMap(metric(UUID_A, { views: 100, clicks: 50, cart_adds: 10 })),
      [
        catalogRow(UUID_A, { stock: 0, added_at: "2026-09-30" }),
        catalogRow(UUID_B),
      ]
    );
    expect(feed.most_popular).not.toContain(UUID_A);
    expect(feed.new_arrivals).not.toContain(UUID_A);
    expect(feed.explore_more).not.toContain(UUID_A);
    expect(feed.on_sale).not.toContain(UUID_A);
  });

  test("inactive product appears in NO section", () => {
    const feed = selectFeed(
      metricsMap(metric(UUID_A, { views: 100, clicks: 50 })),
      [
        catalogRow(UUID_A, { is_active: false }),
        catalogRow(UUID_B),
      ]
    );
    expect(JSON.stringify(feed)).not.toContain(UUID_A);
  });
});

describe("V1 popularity score", () => {
  test("views*1 + clicks*3 + cart_adds*5 + wishlist_adds*2", () => {
    expect(
      popularityScore({ views: 10, clicks: 2, cart_adds: 1, wishlist_adds: 3 })
    ).toBe(10 * 1 + 2 * 3 + 1 * 5 + 3 * 2);
  });
});

describe("most_popular — genuine popularity only", () => {
  test("ranked by score DESC (older added_at so new_arrivals does not claim them)", () => {
    const feed = selectFeed(
      metricsMap(
        metric(UUID_A, { views: 10, clicks: 2 }), // 16
        metric(UUID_B, { views: 30, clicks: 10 }), // 60
        metric(UUID_C, { cart_adds: 3 }) // 15
      ),
      [
        catalogRow(UUID_A, { added_at: "2026-07-03" }),
        catalogRow(UUID_B, { added_at: "2026-07-02" }),
        catalogRow(UUID_C, { added_at: "2026-07-01" }),
        ...newArrivalsAbsorbers(),
      ]
    );
    expect(feed.most_popular).toEqual([UUID_B, UUID_A, UUID_C]);
  });

  test("zero-engagement (untested) products are NOT injected", () => {
    const feed = selectFeed(
      metricsMap(metric(UUID_A, { views: 5 })),
      [
        // A: popular AND oldest — its strongest section is most_popular.
        catalogRow(UUID_A, { added_at: "2026-07-01" }),
        // B, C: untested, older than the absorbers → not claimed by
        // new_arrivals, not popular → discovery candidates.
        catalogRow(UUID_B, { added_at: "2026-07-02" }),
        catalogRow(UUID_C, { added_at: "2026-07-03" }),
        ...newArrivalsAbsorbers(),
      ]
    );
    expect(feed.most_popular).toEqual([UUID_A]);
    // The untested ones never fake popularity — they surface in discovery.
    expect(feed.explore_more).toContain(UUID_B);
    expect(feed.explore_more).toContain(UUID_C);
  });

  test("section size is respected", () => {
    const ids = [UUID_A, UUID_B, UUID_C, UUID_D, UUID_F];
    const rows = [...newArrivalsAbsorbers().slice(0, 4)];
    // Five popular products, all OLDER than the absorbers.
    ids.forEach((id, i) => rows.push(catalogRow(id, { added_at: `2026-07-${10 + i}` })));
    const metrics = metricsMap(...ids.map((id, i) => metric(id, { views: 10 - i })));
    const feed = selectFeed(metrics, rows);
    expect(feed.most_popular.length).toBe(4);
    expect(feed.most_popular[0]).toBe(UUID_A);
  });
});

describe("new_arrivals — genuine recency", () => {
  test("ordered by added_at DESC", () => {
    const feed = selectFeed(
      metricsMap(),
      [
        catalogRow(UUID_A, { added_at: "2026-08-01" }),
        catalogRow(UUID_B, { added_at: "2026-09-02" }),
        catalogRow(UUID_C, { added_at: "2026-09-10" }),
      ]
    );
    expect(feed.new_arrivals).toEqual([UUID_C, UUID_B, UUID_A]);
  });
});

describe("on_sale — genuine discounts only", () => {
  test("only compare_at_price > price products (new_arrivals pre-saturated)", () => {
    const feed = selectFeed(
      metricsMap(),
      [
        // Sale candidates, OLDER than the absorbers so new_arrivals (4
        // newest) does not claim them.
        catalogRow(UUID_A, { added_at: "2026-06-01", price: 100, compare_at_price: 200 }),
        catalogRow(UUID_B, { added_at: "2026-06-02", price: 100, compare_at_price: 100 }), // not a discount
        catalogRow(UUID_C, { added_at: "2026-06-03", price: 100, compare_at_price: 50 }), // inverted
        ...newArrivalsAbsorbers(), // D-F-G plain, newest
      ]
    );
    expect(feed.on_sale).toEqual([UUID_A]);
  });

  test("deepest discount first", () => {
    const feed = selectFeed(
      metricsMap(),
      [
        catalogRow(UUID_A, { added_at: "2026-06-01", price: 90, compare_at_price: 100 }), // 10%
        catalogRow(UUID_B, { added_at: "2026-06-02", price: 50, compare_at_price: 200 }), // 75%
        catalogRow(UUID_C, { added_at: "2026-06-03", price: 80, compare_at_price: 100 }), // 20%
        ...newArrivalsAbsorbers(),
      ]
    );
    expect(feed.on_sale).toEqual([UUID_B, UUID_C, UUID_A]);
  });

  test("normal-price products are never filler", () => {
    const feed = selectFeed(
      metricsMap(),
      [
        catalogRow(UUID_A, { added_at: "2026-06-01" }), // no discount
        catalogRow(UUID_B, { added_at: "2026-06-02", compare_at_price: 300 }),
        ...newArrivalsAbsorbers(),
      ]
    );
    expect(feed.on_sale).toEqual([UUID_B]);
  });
});

describe("explore_more — exposure-based discovery", () => {
  test("lowest cumulative impressions first (underexposed/untested)", () => {
    const feed = selectFeed(
      metricsMap(
        metric(UUID_A, { impressions: 500 }),
        metric(UUID_B, { impressions: 3 }),
        metric(UUID_C, {}) // 0 — never shown
      ),
      [
        catalogRow(UUID_A, { added_at: "2026-06-01" }),
        catalogRow(UUID_B, { added_at: "2026-06-02" }),
        catalogRow(UUID_C, { added_at: "2026-06-03" }),
        ...newArrivalsAbsorbers(),
      ]
    );
    expect(feed.explore_more).toEqual([UUID_C, UUID_B, UUID_A]);
  });

  test("score breaks ties among equally-unexposed products", () => {
    // P1-P4 saturate most_popular (high scores); A and B (lower positive
    // scores, zero exposure) therefore flow past popularity into discovery,
    // where the higher score ranks first among the equally-unexposed.
    const P1 = "88888888-8888-8888-8888-888888888888";
    const P2 = "99999999-9999-9999-9999-999999999999";
    const P3 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const P4 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const feed = selectFeed(
      metricsMap(
        metric(P1, { clicks: 40 }),
        metric(P2, { clicks: 39 }),
        metric(P3, { clicks: 38 }),
        metric(P4, { clicks: 37 }),
        metric(UUID_A, { clicks: 4 }), // promising leftover
        metric(UUID_B, { views: 1 }) // weak leftover
      ),
      [
        catalogRow(P1, { added_at: "2026-05-01" }),
        catalogRow(P2, { added_at: "2026-05-02" }),
        catalogRow(P3, { added_at: "2026-05-03" }),
        catalogRow(P4, { added_at: "2026-05-04" }),
        catalogRow(UUID_A, { added_at: "2026-06-01" }),
        catalogRow(UUID_B, { added_at: "2026-06-02" }),
        ...newArrivalsAbsorbers(),
      ]
    );
    expect(feed.most_popular).toEqual([P1, P2, P3, P4]);
    expect(feed.explore_more).toEqual([UUID_A, UUID_B]);
  });

  test("products used by stronger sections are excluded", () => {
    const feed = selectFeed(
      metricsMap(
        metric(UUID_A, { views: 100 }) // popular
      ),
      [
        // A: popular, older — claimed by most_popular.
        catalogRow(UUID_A, { added_at: "2026-06-01" }),
        // B, C: eligible, untested (score 0) → discovery.
        catalogRow(UUID_B, { added_at: "2026-06-02" }),
        catalogRow(UUID_C, { added_at: "2026-06-03" }),
        ...newArrivalsAbsorbers(),
      ]
    );
    expect(feed.most_popular).toContain(UUID_A);
    expect(feed.explore_more).not.toContain(UUID_A);
    expect(feed.explore_more).toContain(UUID_B);
    expect(feed.explore_more).toContain(UUID_C);
  });
});

describe("cross-section dedup", () => {
  test("one product appears at most once across the snapshot", () => {
    // A: popular AND on sale AND old — most_popular (its strongest
    // section) wins; it must not also consume an on_sale slot.
    const feed = selectFeed(
      metricsMap(metric(UUID_A, { views: 100, clicks: 10 })),
      [
        catalogRow(UUID_A, {
          added_at: "2026-06-01",
          price: 50,
          compare_at_price: 200,
        }),
        catalogRow(UUID_B, { added_at: "2026-06-02", price: 60, compare_at_price: 200 }),
        catalogRow(UUID_C, { added_at: "2026-06-03" }),
        ...newArrivalsAbsorbers(),
      ]
    );
    const all = [
      ...feed.most_popular,
      ...feed.new_arrivals,
      ...feed.explore_more,
      ...feed.on_sale,
    ];
    expect(new Set(all).size).toBe(all.length);
    expect(feed.most_popular).toContain(UUID_A);
    expect(feed.on_sale).not.toContain(UUID_A);
    // B (genuinely discounted, older) takes the on_sale slot A vacated.
    expect(feed.on_sale).toContain(UUID_B);
  });

  test("sections publish fewer products rather than duplicate filler", () => {
    const feed = selectFeed(
      metricsMap(metric(UUID_A, { views: 5 })),
      [catalogRow(UUID_A)]
    );
    expect(feed).toEqual({
      most_popular: [UUID_A],
      new_arrivals: [],
      explore_more: [],
      on_sale: [],
    });
  });
});

describe("empty feed is valid", () => {
  test("no eligible products → all sections empty", () => {
    const feed = selectFeed(
      metricsMap(metric(UUID_A, { views: 9 })),
      [catalogRow(UUID_A, { stock: 0 })]
    );
    expect(feed).toEqual({
      most_popular: [],
      new_arrivals: [],
      explore_more: [],
      on_sale: [],
    });
  });
});

describe("mergedMetrics — durable + batch deltas", () => {
  test("deltas add onto durable counters", () => {
    const merged = mergedMetrics(
      [metric(UUID_A, { views: 10, clicks: 2 })],
      new Map([[UUID_A, delta({ views: 3, clicks: 1, cart_adds: 2 })]])
    );
    expect(merged.get(UUID_A)).toEqual(
      metric(UUID_A, { views: 13, clicks: 3, cart_adds: 2 })
    );
  });

  test("new products get fresh counters", () => {
    const merged = mergedMetrics(
      [],
      new Map([[UUID_B, delta({ impressions: 4 })]])
    );
    expect(merged.get(UUID_B)).toEqual(metric(UUID_B, { impressions: 4 }));
  });
});

describe("sameFeed / parseFeed", () => {
  test("identical feeds compare equal regardless of key order", () => {
    const a = selectFeed(metricsMap(), [catalogRow(UUID_A)]);
    const b = {
      on_sale: a.on_sale,
      explore_more: a.explore_more,
      new_arrivals: a.new_arrivals,
      most_popular: a.most_popular,
    };
    expect(sameFeed(a, b)).toBe(true);
  });

  test("order difference is a change", () => {
    const a = {
      most_popular: [UUID_A, UUID_B],
      new_arrivals: [],
      explore_more: [],
      on_sale: [],
    };
    const b = {
      most_popular: [UUID_B, UUID_A],
      new_arrivals: [],
      explore_more: [],
      on_sale: [],
    };
    expect(sameFeed(a, b)).toBe(false);
  });

  test("parseFeed accepts a valid snapshot", () => {
    expect(
      parseFeed({
        most_popular: [UUID_A],
        new_arrivals: [],
        explore_more: [UUID_B],
        on_sale: [],
      })
    ).toEqual({
      most_popular: [UUID_A],
      new_arrivals: [],
      explore_more: [UUID_B],
      on_sale: [],
    });
  });

  test("parseFeed rejects malformed shapes", () => {
    expect(parseFeed(null)).toBeNull();
    expect(parseFeed("nope")).toBeNull();
    expect(parseFeed({ most_popular: [1, 2] })).toBeNull(); // non-strings
    expect(parseFeed({ most_popular: [] })).toBeNull(); // missing sections
  });
});

describe("determinism", () => {
  test("same inputs produce identical snapshots", () => {
    const metrics = metricsMap(
      metric(UUID_A, { views: 5, impressions: 2 }),
      metric(UUID_B, { clicks: 1 })
    );
    const catalog = [
      catalogRow(UUID_A, { added_at: "2026-08-01", compare_at_price: 150 }),
      catalogRow(UUID_B, { added_at: "2026-09-01" }),
      catalogRow(UUID_C),
    ];
    expect(selectFeed(metrics, catalog)).toEqual(selectFeed(metrics, catalog));
  });
});
