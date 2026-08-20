"use client";

import { useEffect } from "react";
import { trackProductView } from "@/services/tracking";

/**
 * Fires a product_view tracking event on mount. Mounted once per product page
 * visit (not on every render). Tracking is best-effort — failures are silent.
 */
export function ProductViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackProductView(slug);
  }, [slug]);

  return null;
}
