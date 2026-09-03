import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { listProducts } from "@/lib/data/products";
import { decodeEvent, readNotifyMessage } from "@/lib/notify-types";
import { NotifyBanner } from "@/components/NotifyBanner";
import {
  EmptyState,
  FormMessage,
  Input,
  StatusBadge,
  TableShell,
  Td,
  Th,
} from "@/components/ui";
import { Pagination } from "@/components/Pagination";

export const metadata: Metadata = { title: "Products" };

type SearchParams = Promise<{
  q?: string;
  page?: string;
  filter?: string;
  deleted?: string;
  notifyFailed?: string;
  evt?: string;
  msg?: string;
}>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const includeInactive = sp.filter !== "active";
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total, totalPages } = await listProducts({
    q,
    page,
    includeInactive,
  });

  // Server-side decode of the delete-flow notification failure.
  const notifyEvent = decodeEvent(sp.evt);
  const notifyMessage = readNotifyMessage(sp.msg);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (!includeInactive) params.set("filter", "active");
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/products${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted">{total} total</p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New product
        </Link>
      </div>

      {sp.deleted && !sp.notifyFailed && (
        <FormMessage kind="success">Product deleted.</FormMessage>
      )}
      {sp.notifyFailed && notifyEvent && (
        <NotifyBanner
          dbMessage="Product deleted."
          message={notifyMessage}
          event={notifyEvent}
          redirectTo="/products?deleted=1"
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
            placeholder="Search name, slug or SKU…"
            className="w-64 pl-8"
            aria-label="Search products"
          />
        </div>
        {!includeInactive && <input type="hidden" name="filter" value="active" />}
        <button
          type="submit"
          className="h-9 rounded-md border border-line bg-surface px-4 text-sm font-medium hover:bg-background"
        >
          Search
        </button>
      </form>

      {sp.filter === undefined && rows.length === 0 && q === "" && (
        <FormMessage kind="info">
          Showing all products (active + inactive). Add “?filter=active” to hide archived
          products.
        </FormMessage>
      )}

      {rows.length === 0 ? (
        <EmptyState>
          <Package className="mx-auto mb-2 h-6 w-6 text-muted" aria-hidden />
          {q ? `No products match “${q}”.` : "No products yet."}
        </EmptyState>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th>Price</Th>
              <Th>Stock</Th>
              <Th>Status</Th>
              <Th>Category</Th>
              <Th>Updated</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-background/60">
                <Td>
                  <Link
                    href={`/products/${row.id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {row.name}
                  </Link>
                  <p className="text-xs text-muted">/{row.slug}</p>
                </Td>
                <Td className="font-mono text-xs">{row.sku}</Td>
                <Td>₹{row.price.toLocaleString("en-IN")}</Td>
                <Td>
                  {row.is_preorder ? (
                    <span className="text-muted">preorder</span>
                  ) : (
                    row.stock
                  )}
                </Td>
                <Td>
                  <StatusBadge status={row.is_active ? "active" : "inactive"} />
                </Td>
                <Td>{row.categories?.name ?? "—"}</Td>
                <Td className="text-xs text-muted">
                  {new Date(row.updated_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/products/${row.id}`}
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

      <Pagination page={page} totalPages={totalPages} hrefFor={pageHref} />
    </div>
  );
}
