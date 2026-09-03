import { ImageIcon, Star, Trash2 } from "lucide-react";
import type { ProductImageRow } from "@/lib/data/products";
import { addImageAction, deleteImageAction, setPrimaryImageAction } from "../actions";
import { Button, ConfirmButton, EmptyState, Input, SubmitButton } from "@/components/ui";

/**
 * Image management for the existing product_images model: add by R2 URL,
 * remove, or mark the primary image. Positions are assigned automatically;
 * the unique (product_id, position) constraint is respected server-side.
 */
export function ImagesManager({
  productId,
  images,
}: {
  productId: string;
  images: ProductImageRow[];
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
        Images
      </h2>
      <p className="mb-4 text-xs text-muted">
        R2 CDN URLs (https://image.fusiongadgets.in/…). The first image / the marked
        primary is used as the product&apos;s main visual.
      </p>

      {images.length === 0 ? (
        <EmptyState>
          <ImageIcon className="mx-auto mb-2 h-6 w-6 text-muted" aria-hidden />
          No images yet.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {images.map((image) => (
            <li
              key={image.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-line/70 p-2"
            >
              <img
                src={image.url}
                alt={`Image ${image.position + 1}`}
                className="h-12 w-12 rounded border border-line object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted" title={image.url}>
                  {image.url}
                </p>
                <p className="text-[11px] text-muted">
                  position {image.position}
                  {image.is_primary && (
                    <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                      primary
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!image.is_primary && (
                  <form action={setPrimaryImageAction}>
                    <input type="hidden" name="product_id" value={productId} />
                    <input type="hidden" name="image_id" value={image.id} />
                    <Button type="submit" variant="outline" size="sm">
                      <Star className="h-3.5 w-3.5" aria-hidden />
                      Set primary
                    </Button>
                  </form>
                )}
                <form action={deleteImageAction}>
                  <input type="hidden" name="product_id" value={productId} />
                  <input type="hidden" name="image_id" value={image.id} />
                  <ConfirmButton variant="danger" size="sm" confirmLabel="Delete image">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={addImageAction} className="mt-4 flex gap-2">
        <input type="hidden" name="product_id" value={productId} />
        <Input
          name="url"
          type="url"
          required
          placeholder="https://image.fusiongadgets.in/…"
          aria-label="New image URL"
        />
        <SubmitButton variant="outline" pendingLabel="Adding…">
          Add image
        </SubmitButton>
      </form>
    </section>
  );
}
