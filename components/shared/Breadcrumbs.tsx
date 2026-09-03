import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";
import { Link } from "@/components/shared/Link";
import { BreadcrumbBackButton } from "@/components/shared/BreadcrumbBackButton";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb className="flex items-center gap-1.5 text-xs">
      {/* Browser-history back arrow — minimal client island; the trail below
          stays server-rendered. shrink-0 keeps the arrow always visible. */}
      <BreadcrumbBackButton />
      {/* Single-line trail: shrinks into the space left by the arrow
          (min-w-0 + flex-1) and truncates its last item instead of ever
          wrapping to a second line. */}
      <BreadcrumbList className="min-w-0 flex-1 flex-nowrap overflow-hidden whitespace-nowrap">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={i}>
              <BreadcrumbItem className={last ? "min-w-0" : undefined}>
                {last || !c.href ? (
                  <BreadcrumbPage className="truncate text-muted-foreground">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={c.href} className="hover:text-copper">{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
