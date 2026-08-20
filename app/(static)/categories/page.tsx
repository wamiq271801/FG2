import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { ArrowRight } from "lucide-react";
import {
  getAllCategories,
  getCategoryProductCount,
} from "@/modules/catalog/data";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import type { ProductVisualKey } from "@/types";

export const metadata: Metadata = {
  title: "All categories",
  description:
    "Browse every Fusion Gadgets category — audio, keyboards, computing, wearables, cameras, power, desks, and gaming & carry.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "All categories · Fusion Gadgets",
    description:
      "Browse every Fusion Gadgets category — audio, keyboards, computing, wearables, cameras, power, desks, and gaming & carry.",
    url: "/categories",
    type: "website",
  },
};

const visualForCategory: Record<string, ProductVisualKey> = {
  audio: "headphones",
  keyboards: "keyboard",
  computing: "mouse",
  wearables: "watch",
  cameras: "camera",
  power: "charger",
  desks: "lamp",
  "gaming-carry": "controller",
};

export const revalidate = 300;

export default async function CategoriesPage() {
  const categories = await getAllCategories();
  const counts = await Promise.all(
    categories.map((c) => getCategoryProductCount(c.slug))
  );

  return (
    <div className="container-edge py-8 lg:py-12">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Categories" }]}
      />

      <header className="mt-6 max-w-2xl">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-copper" />
          Categories
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
          All categories
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground">
          Eight shelves, each curated by people who use the gear. Pick a
          category to browse products, filter by brand or price, and find what
          fits.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {categories.map((c, idx) => (
          <Link
            key={c.slug}
            href={`/categories/${c.slug}`}
            className="press group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 hover:border-copper/40"
            style={{ ["--accent" as string]: c.accent }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background: `radial-gradient(120% 80% at 85% 8%, color-mix(in oklch, ${c.accent} 16%, transparent), transparent 55%)`,
              }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl leading-tight tracking-tight">
                  {c.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{c.tagline}</p>
              </div>
              <ProductVisual
                visualKey={visualForCategory[c.slug] ?? "headphones"}
                accent={c.accent}
                className="h-20 w-20 shrink-0 rounded-lg border-0 p-0 opacity-90 transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </div>
            <p className="relative mt-4 line-clamp-2 text-pretty text-[13px] leading-relaxed text-muted-foreground">
              {c.description}
            </p>
            <div className="relative mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                {counts[idx]} products
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-copper">
                Browse <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-14 border-t border-border pt-10">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Looking for something specific?{" "}
          <Link href="/search" className="text-copper underline-offset-4 hover:underline">
            Search the catalog
          </Link>{" "}
          or{" "}
          <Link href="/shop" className="text-copper underline-offset-4 hover:underline">
            browse the full shop
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
