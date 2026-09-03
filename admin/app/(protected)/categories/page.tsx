import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Tags } from "lucide-react";
import { listCategories } from "@/lib/data/categories";
import { decodeEvent, readNotifyMessage } from "@/lib/notify-types";
import { NotifyBanner } from "@/components/NotifyBanner";
import { EmptyState, FormMessage, Input, TableShell, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Categories" };

type SearchParams = Promise<{
  q?: string;
  deleted?: string;
  notifyFailed?: string;
  evt?: string;
  msg?: string;
}>;

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const categories = await listCategories({ q });

  // Server-side decode of the delete-flow notification failure.
  const notifyEvent = decodeEvent(sp.evt);
  const notifyMessage = readNotifyMessage(sp.msg);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-muted">{categories.length} total</p>
        </div>
        <Link
          href="/categories/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New category
        </Link>
      </div>

      {sp.deleted && !sp.notifyFailed && (
        <FormMessage kind="success">Category deleted.</FormMessage>
      )}
      {sp.notifyFailed && notifyEvent && (
        <NotifyBanner
          dbMessage="Category deleted."
          message={notifyMessage}
          event={notifyEvent}
          redirectTo="/categories?deleted=1"
        />
      )}

      <form method="get" className="flex flex-wrap gap-2" aria-label="Search">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search name or slug…"
            className="w-64 pl-8"
            aria-label="Search categories"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-md border border-line bg-surface px-4 text-sm font-medium hover:bg-background"
        >
          Search
        </button>
      </form>

      {categories.length === 0 ? (
        <EmptyState>
          <Tags className="mx-auto mb-2 h-6 w-6 text-muted" aria-hidden />
          {q ? `No categories match “${q}”.` : "No categories yet."}
        </EmptyState>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Category</Th>
              <Th>Subcategories</Th>
              <Th>Products</Th>
              <Th>Updated</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="hover:bg-background/60">
                <Td>
                  <Link
                    href={`/categories/${category.id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {category.name}
                  </Link>
                  <p className="text-xs text-muted">/{category.slug}</p>
                </Td>
                <Td className="text-xs text-muted">
                  {category.subcategories?.length
                    ? category.subcategories.join(", ")
                    : "—"}
                </Td>
                <Td>{category.products?.length ?? 0}</Td>
                <Td className="text-xs text-muted">
                  {new Date(category.updated_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/categories/${category.id}`}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
