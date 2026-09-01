"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * BreadcrumbBackButton — the interactive client island of the centralized
 * breadcrumbs. Icon-only button performing real browser-history back
 * navigation (`window.history.back()`); no destination is hardcoded,
 * inferred from the trail, or owned by the app.
 *
 * Breadcrumb rendering stays server-side in `Breadcrumbs.tsx` — only this
 * small button hydrates.
 */
export function BreadcrumbBackButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Go back"
      onClick={() => window.history.back()}
      className="size-7 shrink-0 text-muted-foreground hover:text-copper"
    >
      <ArrowLeft className="size-3.5" />
    </Button>
  );
}
