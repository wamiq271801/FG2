import { Link } from "@/components/shared/Link";
import { ArrowLeft, ArrowRight } from "lucide-react";

type Props = {
  basePath: string;
  /** Search params excluding `page` that should be preserved across pages. */
  queryString: string;
  page: number;
  totalPages: number;
};

/**
 * Pagination — server-rendered, anchor-based pagination for SEO.
 *
 * Renders `prev` / `next` plus a compact set of page numbers. Each link is a
 * real `<a>` so crawlers can follow the trail and the back button works
 * naturally.
 */
export function Pagination({ basePath, queryString, page, totalPages }: Props) {
  if (totalPages <= 1) return null;

  const base = queryString ? `${basePath}${queryString}` : basePath;
  const pageHref = (p: number) =>
    p === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${p}`;

  // Build a compact list of page numbers around the current page.
  const pages: (number | "…")[] = [];
  const push = (n: number | "…") => {
    if (pages[pages.length - 1] !== n) pages.push(n);
  };

  push(1);
  if (page - 2 > 2) push("…");
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) {
    push(p);
  }
  if (page + 2 < totalPages - 1) push("…");
  if (totalPages > 1) push(totalPages);

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const linkClass =
    "press inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:border-copper/40 hover:text-copper disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav
      className="flex items-center justify-center gap-2 py-10"
      aria-label="Pagination"
    >
      <Link
        href={pageHref(Math.max(1, page - 1))}
        aria-label="Previous page"
        aria-disabled={prevDisabled}
        className={`${linkClass} ${prevDisabled ? "pointer-events-none opacity-40" : ""}`}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:ml-1.5">Prev</span>
      </Link>

      <ul className="flex items-center gap-1.5">
        {pages.map((p, i) =>
          p === "…" ? (
            <li
              key={`e${i}`}
              className="px-1 text-sm text-muted-foreground"
              aria-hidden
            >
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={pageHref(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={
                  p === page
                    ? "press inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-foreground px-3 text-sm font-medium text-background"
                    : linkClass
                }
              >
                {p}
              </Link>
            </li>
          )
        )}
      </ul>

      <Link
        href={pageHref(Math.min(totalPages, page + 1))}
        aria-label="Next page"
        aria-disabled={nextDisabled}
        className={`${linkClass} ${nextDisabled ? "pointer-events-none opacity-40" : ""}`}
      >
        <span className="sr-only sm:not-sr-only sm:mr-1.5">Next</span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}
