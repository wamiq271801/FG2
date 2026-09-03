import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { getCategory } from "@/lib/data/categories";
import { getCategoryReferenceCounts } from "@/lib/data/products";
import { decodeEvent, readNotifyMessage } from "@/lib/notify-types";
import { CategoryForm } from "../CategoryForm";
import { deleteCategoryAction, refreshCategoryAction } from "../actions";
import { NotifyBanner } from "@/components/NotifyBanner";
import { ConfirmButton, FormMessage, SubmitButton } from "@/components/ui";

export const metadata: Metadata = { title: "Edit category" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  created?: string;
  error?: string;
  refreshed?: string;
  notifyFailed?: string;
  evt?: string;
  msg?: string;
}>;

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [category, referenceCounts] = await Promise.all([
    getCategory(id),
    getCategoryReferenceCounts(),
  ]);
  if (!category) notFound();

  // Server-side decode of the redirect-based notification failure.
  const notifyEvent = decodeEvent(sp.evt);
  const notifyMessage = readNotifyMessage(sp.msg);

  const productCount = referenceCounts.get(category.id) ?? 0;
  const canDelete = productCount === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{category.name}</h1>
          <p className="text-sm text-muted">
            {productCount} product{productCount === 1 ? "" : "s"} reference this category
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={refreshCategoryAction}>
            <input type="hidden" name="category_id" value={category.id} />
            <SubmitButton variant="outline" size="sm" pendingLabel="Revalidating…">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Revalidate storefront
            </SubmitButton>
          </form>
          {canDelete ? (
            <form action={deleteCategoryAction}>
              <input type="hidden" name="id" value={category.id} />
              <ConfirmButton variant="danger" size="sm" confirmLabel="Delete category">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </ConfirmButton>
            </form>
          ) : (
            <p className="max-w-64 rounded-md border border-line bg-background px-3 py-2 text-xs text-muted">
              Deletion is blocked while products reference this category
              (products.category_id is RESTRICT).
            </p>
          )}
        </div>
      </div>

      {sp.created && <FormMessage kind="success">Category created.</FormMessage>}
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
          redirectTo={`/categories/${id}`}
        />
      )}

      <CategoryForm
        mode="edit"
        id={category.id}
        initial={{
          slug: category.slug,
          name: category.name,
          tagline: category.tagline,
          description: category.description,
          intro: category.intro,
          image: category.image,
          accent: category.accent,
          subcategories: category.subcategories,
          seo_note: category.seo_note,
        }}
      />
    </div>
  );
}
