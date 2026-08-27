/**
 * Canonical Fusion Gadgets business entity.
 *
 * The business entity represents the merchant — the company that sells
 * online AND operates the physical Bahraich store. It is NOT the brand of
 * the products it sells.
 *
 * Fully defined on the homepage; every other page references it by stable
 * `@id` (`…/#organization`) instead of duplicating the definition.
 *
 * Pure transformation of `lib/store-info.ts` — no fetching.
 */

import { storeInfo } from "@/lib/store-info";
import { absoluteUrl } from "@/lib/site";
import { storeRef } from "./store";
import type { JsonLdObject } from "./json-ld";

export function organizationIri(): string {
  return `${absoluteUrl("/")}#organization`;
}

export function organizationRef(): JsonLdObject {
  return { "@id": organizationIri() };
}

/** PostalAddress built from the static business address. */
export function buildPostalAddress(): JsonLdObject {
  const a = storeInfo.address;
  return {
    "@type": "PostalAddress",
    streetAddress: [a.line1, a.line2].filter(Boolean).join(", "),
    addressLocality: a.city,
    addressRegion: a.state,
    postalCode: a.postcode,
    addressCountry: a.country,
  };
}

/** Verified social profiles only — values that exist in store-info. */
function sameAsUrls(): string[] | undefined {
  const urls = Object.values(storeInfo.social).filter(
    (u) => typeof u === "string" && u.length > 0
  );
  const list: string[] = [...urls];
  return list.length > 0 ? list : undefined;
}

/**
 * The canonical merchant entity. Fusion Gadgets operates both online and a
 * physical store, so `OnlineStore` (an Organization subtype) with `hasPOS`
 * pointing at the physical `#store` is the accurate single type.
 */
export function organizationEntity(): JsonLdObject {
  const entity: JsonLdObject = {
    "@type": "OnlineStore",
    "@id": organizationIri(),
    name: storeInfo.name,
    legalName: storeInfo.legalName,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/logo.svg"),
    description: storeInfo.tagline,
    telephone: storeInfo.phone,
    email: storeInfo.email,
    address: buildPostalAddress(),
    hasPOS: storeRef(),
    hasMerchantReturnPolicy: merchantReturnPolicyRef(),
  };
  const sameAs = sameAsUrls();
  if (sameAs) entity.sameAs = sameAs;
  return entity;
}

// ── Merchant return policy (defined on /returns, referenced elsewhere) ──

export function merchantReturnPolicyIri(): string {
  return `${absoluteUrl("/returns")}#return-policy`;
}

export function merchantReturnPolicyRef(): JsonLdObject {
  return { "@id": merchantReturnPolicyIri() };
}

/**
 * The store-wide return policy, from the authoritative Returns page rules:
 * a 7-day window counted from the courier's delivered-timestamp. Fields the
 * policy does not state (return fees/method) are omitted, not invented.
 */
export function merchantReturnPolicyEntity(): JsonLdObject {
  return {
    "@type": "MerchantReturnPolicy",
    "@id": merchantReturnPolicyIri(),
    applicableCountry: "IN",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 7,
  };
}
