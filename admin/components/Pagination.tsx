import Link from "next/link";

/**
 * Server-rendered pagination (Link-based, no client interactivity needed).
 * Kept as a server component so pages can build hrefs server-side.
 */
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="rounded-md border border-line bg-surface px-3 py-1.5 hover:bg-background"
        >
          Previous
        </Link>
      ) : (
        <span className="rounded-md border border-line/60 px-3 py-1.5 text-muted">Previous</span>
      )}
      <span className="text-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className="rounded-md border border-line bg-surface px-3 py-1.5 hover:bg-background"
        >
          Next
        </Link>
      ) : (
        <span className="rounded-md border border-line/60 px-3 py-1.5 text-muted">Next</span>
      )}
    </nav>
  );
}
