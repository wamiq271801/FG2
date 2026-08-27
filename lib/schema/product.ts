/**
 * Product / Offer / Review / Brand schema builders.
 *
 * Pure transformations of the already-loaded Product detail object (and the
 * server-loaded review data the product page renders anyway). No builder
 * here queries anything, and no identifier is fabricated:
 *
 *   - `sku` comes from the database.
 *   - MPN / GTIN / EAN / UPC are OMITTED — no such fields exist.
 *   - `brand` is the product's real manufacturer brand; a missing brand is
 *     omitted, never replaced with the store name.
 *   - No `priceValidUntil` — no authoritative price-expiry date exists.
 *   - AggregateRating / Review only when real public review data exists.
 *   - No ProductGroup — the variation model links independent products and
 *     does not qualify for variant markup.
 */

import { absoluteUrl } from "@/lib/site";
import { merchantReturnPolicyRef, organizationRef } from "./organization";
import type { JsonLdObject } from "./json-ld";
import type { Availability, Product, Review, ReviewSummary } from "@/types";

const SCHEMA_ORG = "https://schema.org";

export function productUrl(slug: string): string {
  return absoluteUrl(`/product/${slug}`);
}

export function productIri(slug: string): string {
  return `${productUrl(slug)}#product`;
}

/** Compact Product reference (e.g. `mainEntity` on the reviews page). */
export function productRef(slug: string, name?: string): JsonLdObject {
  const ref: JsonLdObject = { "@id": productIri(slug), url: productUrl(slug) };
  if (name) ref.name = name;
  return ref;
}

/**
 * The ONE centralized availability mapping. Mirrors the application's
 * derived availability state to Schema.org ItemAvailability values.
 */
export function schemaAvailability(availability: Availability): string {
  switch (availability) {
    case "out-of-stock":
      return `${SCHEMA_ORG}/OutOfStock`;
    case "preorder":
      return `${SCHEMA_ORG}/PreOrder`;
    case "low-stock":
      return `${SCHEMA_ORG}/LimitedAvailability`;
    default:
      return `${SCHEMA_ORG}/InStock`;
  }
}

/** A visible review, using exactly the representation the page displays. */
export function buildReview(review: Review, productSlug: string): JsonLdObject {
  const entity: JsonLdObject = {
    "@type": "Review",
    "@id": `${productUrl(productSlug)}#review-${review.id}`,
    author: { "@type": "Person", name: review.authorName },
    datePublished: review.createdAt,
    reviewBody: review.body,
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
  };
  if (review.title) entity.name = review.title;
  return entity;
}

/** The current purchasable offer, from the authoritative product model. */
function buildOffer(product: Product): JsonLdObject {
  return {
    "@type": "Offer",
    url: productUrl(product.slug),
    price: String(product.price),
    priceCurrency: product.currency,
    availability: schemaAvailability(product.availability),
    itemCondition: `${SCHEMA_ORG}/NewCondition`,
    seller: organizationRef(),
    hasMerchantReturnPolicy: merchantReturnPolicyRef(),
  };
}

export type BuildProductOptions = {
  product: Product;
  /** Real manufacturer brand name — omit when the product has none. */
  brandName?: string;
  /** Human-readable category name (the page already loads it). */
  categoryName?: string;
  /** Server-loaded public aggregate; rating schema only when count > 0. */
  reviewSummary?: ReviewSummary;
  /** Visible public reviews rendered on the page. */
  reviews?: Review[];
};

export function buildProduct(options: BuildProductOptions): JsonLdObject {
  const { product } = options;

  const entity: JsonLdObject = {
    "@type": "Product",
    "@id": productIri(product.slug),
    name: product.name,
    url: productUrl(product.slug),
    offers: buildOffer(product),
  };

  const description = product.description ?? product.tagline;
  if (description) entity.description = description;
  if (product.sku) entity.sku = product.sku;
  if (product.images.length > 0) {
    entity.image = product.images.map((i) => absoluteUrl(i));
  }
  if (options.categoryName) entity.category = options.categoryName;
  if (options.brandName) {
    // No public brand routes exist, so no @id/url is invented for the brand.
    entity.brand = { "@type": "Brand", name: options.brandName };
  }
  if (options.reviewSummary && options.reviewSummary.count > 0) {
    entity.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: options.reviewSummary.average,
      reviewCount: options.reviewSummary.count,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (options.reviews && options.reviews.length > 0) {
    entity.review = options.reviews.map((r) => buildReview(r, product.slug));
  }
  return entity;
}
