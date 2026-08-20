import { Link } from "@/components/shared/Link";
import { X } from "lucide-react";
import type { Brand, Category } from "@/types";
import {
  AVAILABILITY_OPTIONS,
  type Filters,
  buildQuery,
} from "@/modules/catalog/query";

type Props = {
  filters: Filters;
  basePath: string;
  categories: Category[];
  brands: Brand[];
  /** When true, hide the category chips (page is scoped to one category). */
  lockCategory?: boolean;
};

/**
 * ActiveFilters — server-rendered chip list of currently-applied filters.
 * Each chip links to the same URL minus that one facet, so keyboard / screen
 * reader users get real anchor navigation.
 */
export function ActiveFilters({ filters, basePath, categories, brands, lockCategory }: Props) {

  type Chip = { label: string; href: string };

  const chips: Chip[] = [];

  /** Build a URL with one facet value removed. */
  function dropCategory(slug: string): string {
    const next: Filters = {
      ...filters,
      categories: filters.categories.filter((v) => v !== slug),
      page: 1,
    };
    return `${basePath}${buildQuery(next)}`;
  }
  function dropBrand(slug: string): string {
    const next: Filters = {
      ...filters,
      brands: filters.brands.filter((v) => v !== slug),
      page: 1,
    };
    return `${basePath}${buildQuery(next)}`;
  }
  function dropAvailability(value: string): string {
    const next: Filters = {
      ...filters,
      availability: filters.availability.filter((v) => v !== value),
      page: 1,
    };
    return `${basePath}${buildQuery(next)}`;
  }

  if (!lockCategory) {
    for (const slug of filters.categories) {
      const cat = categories.find((c) => c.slug === slug);
      if (!cat) continue;
      chips.push({ label: cat.name, href: dropCategory(slug) });
    }
  }

  for (const slug of filters.brands) {
    const brand = brands.find((b) => b.slug === slug);
    if (!brand) continue;
    chips.push({ label: brand.name, href: dropBrand(slug) });
  }

  for (const a of filters.availability) {
    const opt = AVAILABILITY_OPTIONS.find((o) => o.value === a);
    if (!opt) continue;
    chips.push({ label: opt.label, href: dropAvailability(a) });
  }

  if (filters.minPrice !== undefined && filters.minPrice > 0) {
    chips.push({
      label: `Min ₹${filters.minPrice.toLocaleString("en-IN")}`,
      href: `${basePath}${buildQuery({ ...filters, minPrice: undefined, page: 1 })}`,
    });
  }
  if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
    chips.push({
      label: `Max ₹${filters.maxPrice.toLocaleString("en-IN")}`,
      href: `${basePath}${buildQuery({ ...filters, maxPrice: undefined, page: 1 })}`,
    });
  }

  if (chips.length === 0) return null;

  const clearHref = `${basePath}${buildQuery({
    sort: filters.sort,
    query: filters.query,
  })}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c, i) => (
        <Link
          key={i}
          href={c.href}
          className="press inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper"
        >
          {c.label}
          <X className="h-3 w-3 opacity-60" />
        </Link>
      ))}
      <Link
        href={clearHref}
        className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-copper"
      >
        Clear all
      </Link>
    </div>
  );
}
