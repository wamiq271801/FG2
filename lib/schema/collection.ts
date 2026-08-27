/**
 * CollectionPage / ItemList builders for true collection pages
 * (Shop, Categories index, Category detail, Offers).
 *
 * ItemLists represent the actual collection the page presents — URL-based
 * ListItems referencing the member pages. No nested Product graphs are
 * emitted for listing pages, and no carousel rich result is implied.
 */

import { absoluteUrl } from "@/lib/site";
import { websiteRef } from "./website";
import { webPageIri } from "./webpage";
import type { JsonLdObject } from "./json-ld";

export type ItemListItem = {
  /** Canonical path or absolute URL of the member page. */
  url: string;
  name?: string;
};

export function itemListIri(pagePath: string): string {
  return `${absoluteUrl(pagePath)}#list`;
}

/**
 * Build the ItemList for a collection. Returns undefined for an empty
 * collection so callers can omit it from the graph entirely.
 */
export function buildItemList(
  pagePath: string,
  items: readonly ItemListItem[]
): JsonLdObject | undefined {
  if (items.length === 0) return undefined;
  return {
    "@type": "ItemList",
    "@id": itemListIri(pagePath),
    itemListElement: items.map((item, index) => {
      const listItem: JsonLdObject = {
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(item.url),
      };
      if (item.name) listItem.name = item.name;
      return listItem;
    }),
  };
}

export type CollectionPageOptions = {
  /** Canonical collection path, e.g. "/shop". */
  path: string;
  name?: string;
  description?: string;
  /** Reference to this page's #breadcrumb node. */
  breadcrumb?: JsonLdObject;
  /** Reference (or inline object) for the collection's ItemList. */
  mainEntity?: JsonLdObject;
};

export function collectionPageEntity(
  options: CollectionPageOptions
): JsonLdObject {
  const entity: JsonLdObject = {
    "@type": "CollectionPage",
    "@id": webPageIri(options.path),
    url: absoluteUrl(options.path),
    isPartOf: websiteRef(),
  };
  if (options.name) entity.name = options.name;
  if (options.description) entity.description = options.description;
  if (options.breadcrumb) entity.breadcrumb = options.breadcrumb;
  if (options.mainEntity) entity.mainEntity = options.mainEntity;
  return entity;
}
