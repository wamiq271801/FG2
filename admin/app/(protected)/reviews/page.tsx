import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseZap, MessageSquareText, RefreshCw } from "lucide-react";
import {
  listReviews,
  MigrationRequiredError,
  type ReviewStatus,
} from "@/lib/data/reviews";
import { decodeEvent, readNotifyMessage } from "@/lib/notify-types";
import { refreshReviewAction } from "./actions";
import { ReviewRowActions } from "./ReviewRowActions";
import { NotifyBanner } from "@/components/NotifyBanner";
import {
  EmptyState,
  FormMessage,
  StatusBadge,
  SubmitButton,
  TableShell,
  Td,
  Th,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { Pagination } from "@/components/Pagination";

export const metadata: Metadata = { title: "Reviews" };

type SearchParams = Promise<{
  status?: string;
  page?: string;
  refreshed?: string;
  notifyFailed?: string;
  evt?: string;
  msg?: string;
}>;

const TABS: { key: string; label: string; status?: ReviewStatus }[] = [
  { key: "pending", label: "Pending", status: "pending" },
  { key: "approved", label: "Approved", status: "approved" },
  { key: "rejected", label: "Rejected", status: "rejected" },
  { key: "all", label: "All" },
];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const activeTab = TABS.find((t) => t.key === sp.status)?.key ?? "pending";
  const activeStatus = TABS.find((t) => t.key === activeTab)?.status;
  const page = Math.max(1, Number(sp.page) || 1);

  let result: Awaited<ReturnType<typeof listReviews>> | null = null;
  let migrationError: MigrationRequiredError | null = null;
  try {
    result = await listReviews({ status: activeStatus, page });
  } catch (error) {
    if (error instanceof MigrationRequiredError) {
      migrationError = error;
    } else {
      throw error;
    }
  }

  // Server-side decode of the refresh-flow notification failure; the
  // retry returns to the same tab + page.
  const notifyEvent = decodeEvent(sp.evt);
  const notifyMessage = readNotifyMessage(sp.msg);
  const backHref = `/reviews?status=${activeTab}${page > 1 ? `&page=${page}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Review moderation</h1>
          <p className="text-sm text-muted">
            Approve (pending → approved) or reject (pending → rejected) customer
            reviews. Approved reviews are the only ones publicly visible.
          </p>
        </div>
        <form action={refreshReviewAction}>
          <input type="hidden" name="status" value={activeTab} />
          {page > 1 && <input type="hidden" name="page" value={String(page)} />}
          <SubmitButton variant="outline" size="sm" pendingLabel="Revalidating…">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Revalidate storefront
          </SubmitButton>
        </form>
      </div>

      {sp.refreshed && (
        <FormMessage kind="success">
          Storefront revalidated — the public catalog is up to date.
        </FormMessage>
      )}
      {sp.notifyFailed && notifyEvent && (
        <NotifyBanner
          dbMessage="Storefront refresh requested."
          message={notifyMessage}
          event={notifyEvent}
          redirectTo={backHref}
        />
      )}

      <nav className="flex gap-1" aria-label="Review status filter">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/reviews?status=${tab.key}`}
            aria-current={tab.key === activeTab ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab.key === activeTab
                ? "bg-accent text-white"
                : "border border-line bg-surface text-foreground hover:bg-background"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {migrationError ? (
        <div className="rounded-lg border border-warn/30 bg-warn-soft p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-warn">
            <DatabaseZap className="h-4 w-4" aria-hidden />
            Review moderation migration required
          </h2>
          <p className="mt-2 text-sm text-foreground/80">
            The connected database does not have the moderation columns yet
            (<code className="rounded bg-white/60 px-1">product_reviews.status</code> /{" "}
            <code className="rounded bg-white/60 px-1">customer_name</code>). Product
            and category management work normally — review moderation activates
            once the Phase 1 migration is applied.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-foreground/80">
            <li>
              Open the Supabase SQL Editor for the test project and run{" "}
              <code className="rounded bg-white/60 px-1">
                supabase/migrations/20260901180000_review_moderation_phase1.sql
              </code>{" "}
              as a single script (or apply it via the Supabase MCP).
            </li>
            <li>Reload this page — moderation tabs and actions become live.</li>
          </ol>
        </div>
      ) : result && result.rows.length === 0 ? (
        <EmptyState>
          <MessageSquareText className="mx-auto mb-2 h-6 w-6 text-muted" aria-hidden />
          No {activeTab === "all" ? "" : activeTab} reviews.
        </EmptyState>
      ) : result ? (
        <>
          <p className="text-sm text-muted">{result.total} total</p>
          <TableShell>
            <thead>
              <tr>
                <Th>Review</Th>
                <Th>Product</Th>
                <Th>Rating</Th>
                <Th>Customer</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((review) => (
                <tr key={review.id} className="align-top hover:bg-background/60">
                  <Td className="max-w-96">
                    <p className="font-medium">{review.title || "(no title)"}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {review.body}
                    </p>
                  </Td>
                  <Td>
                    {review.products ? (
                      <>
                        <p className="font-medium">{review.products.name}</p>
                        <p className="text-xs text-muted">/{review.products.slug}</p>
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>{"★".repeat(review.rating)}</Td>
                  <Td>{review.customer_name ?? <span className="text-muted">—</span>}</Td>
                  <Td className="text-xs text-muted">
                    {new Date(review.created_at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Td>
                  <Td>
                    <StatusBadge status={review.status} />
                  </Td>
                  <Td className="text-right">
                    {review.status === "pending" ? (
                      <ReviewRowActions reviewId={review.id} />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          <Pagination
            page={page}
            totalPages={result.totalPages}
            hrefFor={(p) =>
              `/reviews?status=${activeTab}${p > 1 ? `&page=${p}` : ""}`
            }
          />
        </>
      ) : null}
    </div>
  );
}
