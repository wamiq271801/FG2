import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { getBrandOptions, getCategoryOptions, getProduct } from "@/lib/data/products";
import { decodeEvent, readNotifyMessage } from "@/lib/notify-types";
import { ProductForm } from "../ProductForm";
import { ImagesManager } from "./ImagesManager";
import {
  archiveProductAction,
  activateProductAction,
  deleteProductAction,
  refreshProductAction,
} from "../actions";
import { NotifyBanner } from "@/components/NotifyBanner";
import { Button, ConfirmButton, FormMessage, StatusBadge, SubmitButton } from "@/components/ui";

export const metadata: Metadata = { title: "Edit product" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  created?: string;
  error?: string;
  refreshed?: string;
  notifyFailed?: string;
  evt?: string;
  msg?: string;
}>;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [result, brandOptions, categoryOptions] = await Promise.all([
    getProduct(id),
    getBrandOptions(),
    getCategoryOptions(),
  ]);
  if (!result) notFound();

  // Server-side decode of the redirect-based notification failure (the
  // evt param is validated strictly; anything invalid renders nothing).
  const notifyEvent = decodeEvent(sp.evt);
  const notifyMessage = readNotifyMessage(sp.msg);

  const { product, images } = result;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{product.name}</h1>
            <StatusBadge status={product.is_active ? "active" : "inactive"} />
          </div>
          <p className="text-sm text-muted">
            SKU <span className="font-mono">{product.sku}</span> · added{" "}
            {new Date(product.added_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · rating {product.rating} ({product.review_count} reviews)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={refreshProductAction}>
            <input type="hidden" name="product_id" value={product.id} />
            <SubmitButton variant="outline" size="sm" pendingLabel="Revalidating…">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Revalidate storefront
            </SubmitButton>
          </form>
          {product.is_active ? (
            <form action={archiveProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <Button type="submit" variant="outline" size="sm">
                <Archive className="h-3.5 w-3.5" aria-hidden />
                Archive
              </Button>
            </form>
          ) : (
            <form action={activateProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <Button type="submit" variant="ok" size="sm">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Activate
              </Button>
            </form>
          )}
          <form action={deleteProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <ConfirmButton variant="danger" size="sm" confirmLabel="Delete product">
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {sp.created && <FormMessage kind="success">Product created.</FormMessage>}
      {sp.error && <FormMessage kind="error">{decodeURIComponent(sp.error)}</FormMessage>}
      {sp.refreshed && (
        <FormMessage kind="success">
          Storefront revalidated — the public catalog is up to date.
        </FormMessage>
      )}
      {sp.notifyFailed && notifyEvent && (
        <NotifyBanner
          dbMessage="Database updated."
          message={notifyMessage}
          event={notifyEvent}
          redirectTo={`/products/${id}`}
        />
      )}

      <ProductForm
        mode="edit"
        initial={{
          id: product.id,
          sku: product.sku,
          input: {
            slug: product.slug,
            name: product.name,
            subtitle: product.subtitle,
            brand_id: product.brand_id,
            category_id: product.category_id,
            subcategory: product.subcategory,
            tagline: product.tagline,
            description: product.description,
            story: product.story,
            price: product.price,
            compare_at_price: product.compare_at_price,
            visual_key: product.visual_key,
            accent: product.accent,
            stock: product.stock,
            is_active: product.is_active,
            is_preorder: product.is_preorder,
            highlights: product.highlights,
            includes: product.includes,
            specs: product.specs,
            shipping: product.shipping,
            warranty: product.warranty,
          },
        }}
        brandOptions={brandOptions}
        categoryOptions={categoryOptions}
      />

      <ImagesManager productId={product.id} images={images} />
    </div>
  );
}
