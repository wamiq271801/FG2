"use client";

import { useEffect } from "react";
import { trackCategoryView } from "@/services/tracking";

export function CategoryViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackCategoryView(slug);
  }, [slug]);
  return null;
}
