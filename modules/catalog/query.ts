/**
 * Server-side catalog query helpers.
 *
 * Pure functions that take the full product list (from `getAllProducts` or
 * `getProductsByCategory`) and apply URL-driven filters, sort and pagination.
 *
 * These helpers are imported by Server Components only — the client filter UI
 * (`FilterPanel`) builds URLs that this module knows how to parse.
 */

import type { Product } from "@/types";

export type SortKey =
  | "popular"
  | "price-asc"
  | "price-desc"
  | "newest"
  | "rating";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "price-asc", label: "Price · low to high" },
  { value: "price-desc", label: "Price · high to low" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top rated" },
];

export const AVAILABILITY_OPTIONS: {
  value: string;
  label: string;
  hint: string;
}[] = [
  { value: "in-stock", label: "In stock", hint: "Ships now" },
  { value: "on-sale", label: "On sale", hint: "Marked down" },
  { value: "preorder", label: "Pre-order", hint: "Coming soon" },
];

export const PAGE_SIZE = 12;

export type Filters = {
  categories: string[];
  brands: string[];
  availability: string[];
  minPrice?: number;
  maxPrice?: number;
  query?: string;
  sort: SortKey;
  page: number;
};

export type SearchParamsLike = Record<
  string,
  string | string[] | undefined
>;

/** Normalise a searchParams value into a string array. */
export function asArray(
  v: string | string[] | undefined
): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}

export function parseFilters(sp: SearchParamsLike): Filters {
  const sortRaw = typeof sp.sort === "string" ? sp.sort : undefined;
  const sort: SortKey = (SORT_OPTIONS.find((o) => o.value === sortRaw)?.value ??
    "popular") as SortKey;

  const pageRaw = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const min = sp.min ? Number(sp.min) : undefined;
  const max = sp.max ? Number(sp.max) : undefined;

  return {
    categories: asArray(sp.category),
    brands: asArray(sp.brand),
    availability: asArray(sp.availability),
    minPrice: Number.isFinite(min) ? min : undefined,
    maxPrice: Number.isFinite(max) ? max : undefined,
    query: typeof sp.q === "string" ? sp.q : undefined,
    sort,
    page,
  };
}

/** A product is "on sale" when it has a higher compareAt price. */
export function isOnSale(p: Product): boolean {
  return Boolean(p.compareAt && p.compareAt > p.price);
}

export function applyFilters(products: Product[], f: Filters): Product[] {
  return products.filter((p) => {
    if (f.categories.length && !f.categories.includes(p.category)) return false;
    if (f.brands.length && !f.brands.includes(p.brand)) return false;
    if (f.minPrice !== undefined && p.price < f.minPrice) return false;
    if (f.maxPrice !== undefined && p.price > f.maxPrice) return false;

    if (f.availability.length) {
      const ok = f.availability.some((a) => {
        if (a === "in-stock")
          return p.availability === "in-stock" || p.availability === "low-stock";
        if (a === "on-sale") return isOnSale(p);
        if (a === "preorder") return p.availability === "preorder";
        return false;
      });
      if (!ok) return false;
    }

    if (f.query) {
      const q = f.query.trim().toLowerCase();
      if (q) {
        const haystack =
          `${p.name} ${p.subtitle} ${p.tagline} ${p.description ?? ""} ${p.subcategory ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
    }
    return true;
  });
}

export function applySort(products: Product[], sort: SortKey): Product[] {
  const copy = [...products];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "newest":
      return copy.sort((a, b) => +new Date(b.addedAt) - +new Date(a.addedAt));
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating);
    case "popular":
    default:
      return copy.sort((a, b) => b.reviewCount - a.reviewCount);
  }
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = PAGE_SIZE
): { items: T[]; totalPages: number; total: number; page: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    total,
    page: safePage,
  };
}

/**
 * Build a querystring for the given partial filter set.
 * Empty / default values are dropped to keep URLs clean.
 */
export function buildQuery(
  f: Partial<Filters> & { preserve?: Record<string, string | undefined> } = {}
): string {
  const params = new URLSearchParams();

  // Preserve unrelated params (e.g. q on shop, sort on category).
  if (f.preserve) {
    for (const [k, v] of Object.entries(f.preserve)) {
      if (v) params.set(k, v);
    }
  }

  (f.categories ?? []).forEach((c) => params.append("category", c));
  (f.brands ?? []).forEach((b) => params.append("brand", b));
  (f.availability ?? []).forEach((a) => params.append("availability", a));
  if (f.minPrice !== undefined && Number.isFinite(f.minPrice) && f.minPrice > 0)
    params.set("min", String(Math.round(f.minPrice)));
  if (f.maxPrice !== undefined && Number.isFinite(f.maxPrice) && f.maxPrice > 0)
    params.set("max", String(Math.round(f.maxPrice)));
  if (f.query && f.query.trim()) params.set("q", f.query.trim());
  if (f.sort && f.sort !== "popular") params.set("sort", f.sort);
  if (f.page && f.page > 1) params.set("page", String(f.page));

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Count active filter facets for the "clear all" affordance. */
export function countActiveFilters(f: Filters): number {
  let n = 0;
  n += f.categories.length;
  n += f.brands.length;
  n += f.availability.length;
  if (f.minPrice !== undefined && f.minPrice > 0) n++;
  if (f.maxPrice !== undefined && f.maxPrice > 0) n++;
  return n;
}

/** Min/max price across the product set — used to bound the price filter UI. */
export function priceBounds(products: Product[]): { min: number; max: number } {
  if (!products.length) return { min: 0, max: 100000 };
  let min = Infinity;
  let max = -Infinity;
  for (const p of products) {
    if (p.price < min) min = p.price;
    if (p.price > max) max = p.price;
  }
  // Round to friendly thousands.
  const floorMin = Math.max(0, Math.floor(min / 1000) * 1000);
  const ceilMax = Math.ceil(max / 1000) * 1000;
  return { min: floorMin, max: ceilMax };
}
