/**
 * Minimal Server Component that emits ONE JSON-LD graph as server-rendered
 * HTML. Pages build the graph with `lib/schema` builders from data they have
 * already loaded; this component only serializes it safely.
 */

import { serializeJsonLd, type JsonLdGraph } from "@/lib/schema";

export function JsonLd({ data }: { data: JsonLdGraph }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
