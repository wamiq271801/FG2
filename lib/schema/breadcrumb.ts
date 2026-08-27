/**
 * ONE reusable BreadcrumbList builder.
 *
 * Accepts already-known breadcrumb items (real page hierarchy — no URL
 * segment guessing, no fetching) and gives the list a stable page-local
 * `@id` so WebPage nodes can reference it as `{ "@id": "…#breadcrumb" }`.
 */

import { absoluteUrl } from "@/lib/site";
import type { JsonLdObject } from "./json-ld";

export type BreadcrumbItem = {
  name: string;
  /** Canonical path of the crumb target. Omit for the current page. */
  path?: string;
};

export function breadcrumbIri(pagePath: string): string {
  return `${absoluteUrl(pagePath)}#breadcrumb`;
}

export function breadcrumbRef(pagePath: string): JsonLdObject {
  return { "@id": breadcrumbIri(pagePath) };
}

export function buildBreadcrumbList(
  pagePath: string,
  items: readonly BreadcrumbItem[]
): JsonLdObject {
  return {
    "@type": "BreadcrumbList",
    "@id": breadcrumbIri(pagePath),
    itemListElement: items.map((item, index) => {
      const listItem: JsonLdObject = {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
      };
      if (item.path) listItem.item = absoluteUrl(item.path);
      return listItem;
    }),
  };
}
