/**
 * Physical retail location entity — the Bahraich store.
 *
 * Fully defined on /contact (the page that actually represents the physical
 * location); referenced everywhere else as `…/#store`. All data comes from
 * the static business source (`lib/store-info.ts`).
 */

import { storeInfo } from "@/lib/store-info";
import { absoluteUrl } from "@/lib/site";
import { buildPostalAddress, organizationRef } from "./organization";
import type { JsonLdObject } from "./json-ld";

export function storeIri(): string {
  return `${absoluteUrl("/")}#store`;
}

export function storeRef(): JsonLdObject {
  return { "@id": storeIri() };
}

export function storeEntity(): JsonLdObject {
  const entity: JsonLdObject = {
    "@type": "Store",
    "@id": storeIri(),
    name: storeInfo.name,
    address: buildPostalAddress(),
    telephone: storeInfo.phone,
    parentOrganization: organizationRef(),
    geo: {
      "@type": "GeoCoordinates",
      latitude: storeInfo.geo.latitude,
      longitude: storeInfo.geo.longitude,
    },
    openingHoursSpecification: storeInfo.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [...h.days],
      opens: h.opens,
      closes: h.closes,
    })),
  };
  return entity;
}
