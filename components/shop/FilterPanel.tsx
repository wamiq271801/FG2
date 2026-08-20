"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Link } from "@/components/shared/Link";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { formatPricePlain } from "@/lib/format";
import { AVAILABILITY_OPTIONS } from "@/modules/catalog/query";

export type FilterFacet = {
  slug: string;
  name: string;
  count: number;
};

type Props = {
  /** All categories available as facets (may be scoped to current category). */
  categories: FilterFacet[];
  /** All brands available as facets. */
  brands: FilterFacet[];
  /** Bounded min/max for the price slider. */
  priceBounds: { min: number; max: number };
  /** Base path the form pushes to (e.g. "/shop" or "/categories/audio"). */
  basePath: string;
  /** When true, hide the category facet (we are scoped to a single category). */
  lockCategory?: boolean;
  /** Called after a navigation push — used by the mobile sheet to close. */
  onApplied?: () => void;
  /** Compact heading treatment (used inside the mobile sheet). */
  compact?: boolean;
};

/**
 * FilterPanel — a controlled form whose state lives in the URL search params.
 *
 * On every checkbox toggle the panel pushes a new URL via `router.push`, which
 * causes the parent Server Component to re-render with the new result set.
 * No client state, no stale UI — the URL is the single source of truth.
 */
export function FilterPanel({
  categories,
  brands,
  priceBounds,
  basePath,
  lockCategory,
  onApplied,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedCats = sp.getAll("category");
  const selectedBrands = sp.getAll("brand");
  const selectedAvail = sp.getAll("availability");
  const minPrice = sp.get("min");
  const maxPrice = sp.get("max");

  function pushParams(next: URLSearchParams) {
    // Clean empties + reset pagination when filters change.
    const cleaned = new URLSearchParams();
    next.forEach((v, k) => {
      if (v !== "" && v !== null) cleaned.append(k, v);
    });
    cleaned.delete("page");
    const qs = cleaned.toString();
    const url = qs ? `${basePath}?${qs}` : basePath;
    startTransition(() => {
      router.push(url);
      onApplied?.();
    });
  }

  function toggle(key: string, value: string, currentlySelected: string[]) {
    const params = new URLSearchParams(sp.toString());
    params.delete(key);
    const next = currentlySelected.includes(value)
      ? currentlySelected.filter((v) => v !== value)
      : [...currentlySelected, value];
    next.forEach((v) => params.append(key, v));
    pushParams(params);
  }

  function setPrice(kind: "min" | "max", value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value === "") params.delete(kind);
    else params.set(kind, value);
    pushParams(params);
  }

  function clearAll() {
    const params = new URLSearchParams();
    // Preserve sort + q (query) — those aren't really "filters".
    const sort = sp.get("sort");
    if (sort) params.set("sort", sort);
    const q = sp.get("q");
    if (q) params.set("q", q);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
      onApplied?.();
    });
  }

  const hasActive =
    selectedCats.length +
    selectedBrands.length +
    selectedAvail.length +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) >
    0;

  return (
    <div
      className={isPending ? "opacity-70 transition-opacity" : "transition-opacity"}
      aria-busy={isPending}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base tracking-tight">Filter</h2>
        {hasActive && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] font-medium uppercase tracking-wide text-copper hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Category facet — hidden when scoped to a single category page */}
      {!lockCategory && categories.length > 0 && (
        <section className="mt-5">
          <FacetHeading>Category</FacetHeading>
          <ul className="mt-3 space-y-2.5">
            {categories.map((c) => {
              const id = `f-cat-${c.slug}`;
              const checked = selectedCats.includes(c.slug);
              return (
                <li key={c.slug}>
                  <Label htmlFor={id} className="flex items-center justify-between gap-2 text-sm font-normal">
                    <span className="flex items-center gap-2.5">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={() =>
                          toggle("category", c.slug, selectedCats)
                        }
                      />
                      <span className={checked ? "text-foreground" : "text-muted-foreground"}>
                        {c.name}
                      </span>
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {c.count}
                    </span>
                  </Label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Availability facet */}
      <Separator className="my-5" />
      <section>
        <FacetHeading>Availability</FacetHeading>
        <ul className="mt-3 space-y-2.5">
          {AVAILABILITY_OPTIONS.map((a) => {
            const id = `f-avail-${a.value}`;
            const checked = selectedAvail.includes(a.value);
            return (
              <li key={a.value}>
                <Label htmlFor={id} className="flex items-center justify-between gap-2 text-sm font-normal">
                  <span className="flex items-center gap-2.5">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={() =>
                        toggle("availability", a.value, selectedAvail)
                      }
                    />
                    <span className={checked ? "text-foreground" : "text-muted-foreground"}>
                      {a.label}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">{a.hint}</span>
                </Label>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Brand facet */}
      {brands.length > 0 && (
        <>
          <Separator className="my-5" />
          <section>
            <FacetHeading>Brand</FacetHeading>
            <ul className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {brands.map((b) => {
                const id = `f-brand-${b.slug}`;
                const checked = selectedBrands.includes(b.slug);
                return (
                  <li key={b.slug}>
                    <Label htmlFor={id} className="flex items-center justify-between gap-2 text-sm font-normal">
                      <span className="flex items-center gap-2.5">
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={() =>
                            toggle("brand", b.slug, selectedBrands)
                          }
                        />
                        <span className={checked ? "text-foreground" : "text-muted-foreground"}>
                          {b.name}
                        </span>
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {b.count}
                      </span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* Price facet */}
      <Separator className="my-5" />
      <section>
        <FacetHeading>Price (₹)</FacetHeading>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              ₹
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={priceBounds.min}
              max={priceBounds.max}
              placeholder={String(priceBounds.min)}
              defaultValue={minPrice ?? ""}
              onBlur={(e) => setPrice("min", e.target.value)}
              className="h-9 pl-6 text-sm"
              aria-label="Minimum price"
            />
          </div>
          <span className="text-muted-foreground">–</span>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              ₹
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={priceBounds.min}
              max={priceBounds.max}
              placeholder={formatPricePlain(priceBounds.max)}
              defaultValue={maxPrice ?? ""}
              onBlur={(e) => setPrice("max", e.target.value)}
              className="h-9 pl-6 text-sm"
              aria-label="Maximum price"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Tab away to apply.
        </p>
      </section>

      {hasActive && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-6 w-full press"
        >
          <Link href={basePath} onClick={clearAll}>
            <X className="h-3.5 w-3.5" /> Clear all filters
          </Link>
        </Button>
      )}
    </div>
  );
}

function FacetHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h3>
  );
}
