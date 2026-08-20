"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FilterPanel, type FilterFacet } from "./FilterPanel";

type Props = {
  categories: FilterFacet[];
  brands: FilterFacet[];
  priceBounds: { min: number; max: number };
  basePath: string;
  lockCategory?: boolean;
  activeCount: number;
};

/**
 * MobileFilters — a Sheet that wraps the FilterPanel for small screens.
 *
 * Closes automatically when a filter is applied (so the user sees results).
 */
export function MobileFilters({
  categories,
  brands,
  priceBounds,
  basePath,
  lockCategory,
  activeCount,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="press lg:hidden"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-copper px-1 text-[10px] font-semibold text-copper-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[88%] max-w-sm overflow-y-auto p-0"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg tracking-tight">
            Filter &amp; refine
          </SheetTitle>
        </SheetHeader>
        <div className="p-5">
          <FilterPanel
            categories={categories}
            brands={brands}
            priceBounds={priceBounds}
            basePath={basePath}
            lockCategory={lockCategory}
            onApplied={() => setOpen(false)}
            compact
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
