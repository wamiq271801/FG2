/**
 * Canonical WebSite entity.
 *
 * Defined on the homepage; other pages reference `…/#website` through
 * `isPartOf`. No SearchAction — Google retired the Sitelinks Search Box
 * feature, and it must not be re-implemented.
 */

import { storeInfo } from "@/lib/store-info";
import { absoluteUrl } from "@/lib/site";
import { organizationRef } from "./organization";
import type { JsonLdObject } from "./json-ld";

export function websiteIri(): string {
  return `${absoluteUrl("/")}#website`;
}

export function websiteRef(): JsonLdObject {
  return { "@id": websiteIri() };
}

export function websiteEntity(): JsonLdObject {
  return {
    "@type": "WebSite",
    "@id": websiteIri(),
    url: absoluteUrl("/"),
    name: storeInfo.name,
    publisher: organizationRef(),
  };
}
