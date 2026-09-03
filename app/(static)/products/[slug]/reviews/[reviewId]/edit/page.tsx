import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/modules/catalog/products";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { ReviewEditGate } from "./ReviewEditGate";

type Params = Promise<{ slug: string; reviewId: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `Edit review · ${product.name}`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/products/${slug}/reviews` },
  };
}

export default async function EditReviewPage({ params }: { params: Params }) {
  // COMPLETE server-rendered page: params are awaited directly in the page
  // and the product scope resolves before the page renders (the root
  // layout's above-body Suspense boundary is the official fully-dynamic
  // opt-in). The auth-dependent form still lives in the ReviewEditGate
  // client island; getProductBySlug reads through the shared "product"
  // cache entry. The review itself is fetched client-side by the gate with
  // the signed-in user's session — a pending review is only visible to its
  // owner (approved reviews are public), so an anonymous SSR fetch would 404
  // the owner's edit page.
  const { slug, reviewId } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const primaryImage = product.images[0];

  return (
    <main className="container-edge py-8 lg:py-12">
      <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href={`/product/${product.slug}`} className="hover:text-foreground">
          {product.name}
        </Link>{" "}
        <span aria-hidden>›</span>{" "}
        <Link href={`/products/${product.slug}/reviews`} className="hover:text-foreground">
          Reviews
        </Link>{" "}
        <span aria-hidden>›</span> Edit
      </nav>

      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center gap-4">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product.name}
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
          ) : (
            <ProductVisual
              visualKey={product.visualKey}
              accent={product.accent}
              className="h-20 w-20 rounded-lg border border-border"
            />
          )}
          <div>
            <h1 className="font-display text-2xl tracking-tight">Edit your review</h1>
            <p className="text-sm text-muted-foreground">{product.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              SKU {product.sku}
            </p>
          </div>
        </header>

        {/* The gate renders the form itself client-side — function props
            cannot cross the Server→Client component boundary. */}
        <ReviewEditGate reviewId={reviewId} slug={product.slug} />
      </div>
    </main>
  );
}
