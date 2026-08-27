/**
 * Page entity builders.
 *
 * Every public page's WebPage node uses the same `canonical-url#webpage` ID
 * pattern and links to the canonical `#website` via `isPartOf`. Subtypes
 * (AboutPage, ContactPage) are used only where genuinely appropriate.
 */

import { absoluteUrl } from "@/lib/site";
import { websiteRef } from "./website";
import type { JsonLdObject } from "./json-ld";

export function webPageIri(path: string): string {
  return `${absoluteUrl(path)}#webpage`;
}

export function webPageRef(path: string): JsonLdObject {
  return { "@id": webPageIri(path) };
}

export type WebPageOptions = {
  /** Canonical page path, e.g. "/about" or "/" for the homepage. */
  path: string;
  /** WebPage (default) or a genuinely appropriate subtype. */
  type?: "WebPage" | "AboutPage" | "ContactPage";
  name?: string;
  description?: string;
  /** Reference to an entity this page is about (e.g. #organization). */
  about?: JsonLdObject;
  /** Reference to the page's primary entity (e.g. #product). */
  mainEntity?: JsonLdObject;
  /** Reference to this page's #breadcrumb node. */
  breadcrumb?: JsonLdObject;
};

export function webPageEntity(options: WebPageOptions): JsonLdObject {
  const entity: JsonLdObject = {
    "@type": options.type ?? "WebPage",
    "@id": webPageIri(options.path),
    url: absoluteUrl(options.path),
    isPartOf: websiteRef(),
  };
  if (options.name) entity.name = options.name;
  if (options.description) entity.description = options.description;
  if (options.about) entity.about = options.about;
  if (options.mainEntity) entity.mainEntity = options.mainEntity;
  if (options.breadcrumb) entity.breadcrumb = options.breadcrumb;
  return entity;
}
