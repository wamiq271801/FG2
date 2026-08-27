/**
 * Centralized Schema.org / JSON-LD system.
 *
 * Pure entity builders over already-loaded page data. Nothing in this
 * directory fetches, caches, or stores anything — see json-ld.ts for the
 * one safe serializer and lib/site.ts for the environment-backed origin.
 */

export type { JsonLdObject, JsonLdGraph } from "./json-ld";
export {
  buildJsonLdGraph,
  serializeJsonLd,
} from "./json-ld";

export {
  organizationIri,
  organizationRef,
  organizationEntity,
  buildPostalAddress,
  merchantReturnPolicyIri,
  merchantReturnPolicyRef,
  merchantReturnPolicyEntity,
} from "./organization";

export {
  websiteIri,
  websiteRef,
  websiteEntity,
} from "./website";

export {
  storeIri,
  storeRef,
  storeEntity,
} from "./store";

export {
  webPageIri,
  webPageRef,
  webPageEntity,
  type WebPageOptions,
} from "./webpage";

export {
  breadcrumbIri,
  breadcrumbRef,
  buildBreadcrumbList,
  type BreadcrumbItem,
} from "./breadcrumb";

export {
  productIri,
  productUrl,
  productRef,
  schemaAvailability,
  buildReview,
  buildProduct,
  type BuildProductOptions,
} from "./product";

export {
  itemListIri,
  buildItemList,
  collectionPageEntity,
  type ItemListItem,
  type CollectionPageOptions,
} from "./collection";
