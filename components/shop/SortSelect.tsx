"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_OPTIONS, type SortKey } from "@/modules/catalog/query";

type Props = {
  basePath: string;
  ariaLabel?: string;
  className?: string;
};

/**
 * SortSelect — pushes a new `?sort=` search param on change.
 *
 * Server-driven: the page renders with the new sort param, the URL is the
 * source of truth. Other query params are preserved.
 */
export function SortSelect({ basePath, ariaLabel, className }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const current =
    (SORT_OPTIONS.find((o) => o.value === sp.get("sort"))?.value as SortKey) ??
    "popular";

  function onChange(value: SortKey) {
    const params = new URLSearchParams(sp.toString());
    if (value === "popular") params.delete("sort");
    else params.set("sort", value);
    // Reset pagination when sort changes.
    params.delete("page");
    const qs = params.toString();
    const url = qs ? `${basePath}?${qs}` : basePath;
    startTransition(() => router.push(url));
  }

  return (
    <Select value={current} onValueChange={(v) => onChange(v as SortKey)}>
      <SelectTrigger
        aria-label={ariaLabel ?? "Sort products"}
        size="sm"
        className={className}
      >
        <span className="text-muted-foreground">Sort:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
