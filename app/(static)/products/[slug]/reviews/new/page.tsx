import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/modules/catalog/data";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { ReviewForm } from "@/components/review/ReviewForm";
import { ReviewGate } from "./ReviewGate";

export const revalidate = 0; // dynamic — auth-dependent

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `Write a review · ${product.name}`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/products/${slug}/reviews/new` },
  };
}

export default async function WriteReviewPage({ params }: { params: Params }) {
  const { slug } = await params;
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
        <span aria-hidden>›</span> Write a review
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
            <h1 className="font-display text-2xl tracking-tight">
              Write a review
            </h1>
            <p className="text-sm text-muted-foreground">{product.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              FGPN {product.fgpNumber}
            </p>
          </div>
        </header>

        <ReviewGate
          productId={product.id}
          slug={product.slug}
          renderForm={(productId) => (
            <ReviewForm mode={{ kind: "create", productId }} slug={product.slug} />
          )}
        />
      </div>
    </main>
  );
}
