import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import {
  ArrowRight,
  Clock,
  Tag,
  Sparkles,
  Info,
  PackageOpen,
} from "lucide-react";
import {
  getAllCategories,
  getAllPromotions,
  getOnSaleProducts,
  getPromotionBySlug,
  getPromotionProducts,
} from "@/modules/catalog/data";
import { ProductCard } from "@/components/shared/ProductCard";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Price } from "@/components/shared/Price";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { Promotion } from "@/types";

export const metadata: Metadata = {
  title: "Offers",
  description:
    "Current promotions, bundles and sale items at Fusion Gadgets — the Festive Edit, Sound Together bundle, Desk Refresh, and quietly marked-down favourites. Limited time only.",
  alternates: { canonical: "/offers" },
  openGraph: {
    title: "Offers · Fusion Gadgets",
    description:
      "Current promotions, bundles and sale items at Fusion Gadgets. Limited time only.",
    url: "/offers",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Offers · Fusion Gadgets",
    description:
      "Current promotions, bundles and sale items at Fusion Gadgets. Limited time only.",
  },
};

const FEATURED_PROMO_SLUG = "festive-edit";

export const revalidate = 300;

export default async function OffersPage() {
  const [promotions, featured, onSale, allCategories] = await Promise.all([
    getAllPromotions(),
    getPromotionBySlug(FEATURED_PROMO_SLUG),
    getOnSaleProducts(),
    getAllCategories(),
  ]);
  const featuredProducts = featured ? await getPromotionProducts(featured) : [];
  const otherPromotions = promotions.filter(
    (p) => p.slug !== FEATURED_PROMO_SLUG
  );

  // Categories that contain at least one sale product.
  const saleCategorySlugs = new Set(onSale.map((p) => p.category));
  const saleCategories = allCategories.filter((c) =>
    saleCategorySlugs.has(c.slug)
  );

  return (
    <div className="container-edge py-8 lg:py-12">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Offers" },
        ]}
      />

      {/* Header */}
      <header className="mt-6 max-w-3xl">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-copper" />
          <Tag className="h-3.5 w-3.5 text-copper" />
          Limited time
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.04] tracking-tight text-balance md:text-5xl lg:text-6xl">
          Offers, edited.
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
          A small, deliberate set of promotions and bundles — never a fire sale.
          The Festive Edit gathers our most-gifted tech at a quieter price; the
          bundles pair things that genuinely belong together. When they&#39;re
          gone, they&#39;re gone.
        </p>
      </header>

      {/* ── Featured promotion ───────────────────────────────────── */}
      {featured && featuredProducts.length > 0 && (
        <section
          aria-labelledby="featured-heading"
          className="mt-12 overflow-hidden rounded-2xl border border-border bg-foreground text-background"
        >
          <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
            <div className="relative flex flex-col justify-between gap-6 p-8 lg:p-12">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-background/60">
                  <span className="h-px w-8 bg-copper" />
                  Featured promotion
                </p>
                <h2
                  id="featured-heading"
                  className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl"
                >
                  {featured.title}
                </h2>
                <p className="mt-1.5 inline-flex items-center rounded-full bg-copper px-3 py-1 text-xs font-semibold uppercase tracking-wide text-copper-foreground">
                  {featured.badge}
                </p>
                <p className="mt-5 max-w-md text-pretty text-[15px] leading-relaxed text-background/75">
                  {featured.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button asChild variant="secondary" className="press">
                  <Link href={`/product/${featuredProducts[0].slug}`}>
                    Shop the edit <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <PromotionExpiry promo={featured} dark />
              </div>
            </div>
            <div className="relative grid grid-cols-2 gap-3 bg-background/5 p-6 lg:p-8">
              {featuredProducts.slice(0, 4).map((p) => (
                <Link
                  key={p.slug}
                  href={`/product/${p.slug}`}
                  className="press group relative overflow-hidden rounded-xl border border-background/10 bg-background"
                  aria-label={p.name}
                >
                  <ProductVisual
                    visualKey={p.visualKey}
                    accent={p.accent}
                    className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-foreground/85 to-transparent p-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-background/70">
                        {p.subtitle}
                      </p>
                      <p className="font-display text-sm leading-tight text-background">
                        {p.name}
                      </p>
                    </div>
                    <Price
                      price={p.price}
                      compareAt={p.compareAt}
                      size="sm"
                      className="text-background"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── All promotions ───────────────────────────────────────── */}
      {otherPromotions.length > 0 && (
        <section
          aria-labelledby="all-promos-heading"
          className="mt-16 border-t border-border pt-12 lg:mt-20"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
                All promotions
              </p>
              <h2
                id="all-promos-heading"
                className="mt-3 font-display text-2xl tracking-tight md:text-3xl"
              >
                Bundles & editor&#39;s picks.
              </h2>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-8">
            {otherPromotions.map((promo) => (
              <PromotionSection key={promo.slug} promo={promo} />
            ))}
          </div>
        </section>
      )}

      {/* ── On sale grid ─────────────────────────────────────────── */}
      <section
        aria-labelledby="sale-heading"
        className="mt-16 border-t border-border pt-12 lg:mt-20"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
              On sale
            </p>
            <h2
              id="sale-heading"
              className="mt-3 font-display text-2xl tracking-tight md:text-3xl"
            >
              Quietly marked down.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Individual items with a reduced price. No code needed — discounts
              apply at checkout.
            </p>
          </div>
        </div>

        {/* Sale category chips */}
        {saleCategories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {saleCategories.map((c) => {
              const count = onSale.filter((p) => p.category === c.slug).length;
              return (
                <Link
                  key={c.slug}
                  href={`/categories/${c.slug}?availability=on-sale`}
                  className="press inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper"
                >
                  {c.name}
                  <span className="text-muted-foreground">· {count}</span>
                </Link>
              );
            })}
          </div>
        )}

        {onSale.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {onSale.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <PackageOpen
              className="h-10 w-10 text-muted-foreground"
              strokeWidth={1.25}
            />
            <div>
              <h3 className="font-display text-xl tracking-tight">
                No active markdowns.
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                We don&#39;t run a permanent sale rack. New markdowns appear
                here when something is genuinely being cleared.
              </p>
            </div>
            <Button asChild className="press">
              <Link href="/shop">
                <ArrowRight className="h-4 w-4" />
                Browse the shop
              </Link>
            </Button>
          </div>
        )}
      </section>

      {/* ── Terms / conditions ───────────────────────────────────── */}
      <section
        aria-labelledby="terms-heading"
        className="mt-16 border-t border-border pt-12 lg:mt-20"
      >
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-copper" />
            The fine print
          </div>
          <h2
            id="terms-heading"
            className="mt-3 font-display text-2xl tracking-tight"
          >
            Terms &amp; conditions.
          </h2>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li className="flex gap-3">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
              <span>
                Promotional pricing is applied automatically at checkout — no
                discount code is required unless explicitly stated.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
              <span>
                Offers are valid only on in-stock items and cannot be combined
                with other promotions, unless the promotion is a bundle
                (clearly labelled as such).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
              <span>
                Bundle discounts apply only when all items in the bundle are
                present in the cart at checkout.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
              <span>
                Promotion end dates, where shown, are in Indian Standard Time
                (IST). Fusion Gadgets reserves the right to extend or withdraw
                offers at any time.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
              <span>
                Standard return and warranty terms apply to all promotional
                items. See our{" "}
                <Link
                  href="/returns"
                  className="text-copper underline-offset-4 hover:underline"
                >
                  returns policy
                </Link>{" "}
                for details.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

async function PromotionSection({ promo }: { promo: Promotion }) {
  const products = await getPromotionProducts(promo);
  if (products.length === 0) return null;

  return (
    <article className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Identity column */}
        <div className="relative flex flex-col justify-between gap-6 border-b border-border p-7 lg:border-b-0 lg:border-r lg:p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(120% 80% at 100% 0%, color-mix(in oklch, var(--copper) 14%, transparent), transparent 60%)",
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-copper/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-copper">
                <Sparkles className="h-3 w-3" />
                {promo.badge}
              </span>
            </div>
            <h3 className="mt-4 font-display text-2xl leading-tight tracking-tight md:text-3xl">
              {promo.title}
            </h3>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              {promo.description}
            </p>
          </div>
          <div className="relative flex flex-col gap-3">
            <PromotionExpiry promo={promo} />
            <Button asChild variant="outline" className="press w-fit">
              <Link href={`/product/${products[0].slug}`}>
                Shop this promo <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              <span className="font-medium text-muted-foreground">Terms:</span>{" "}
              {promo.terms}
            </p>
          </div>
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 p-7 sm:grid-cols-3 lg:gap-x-6 lg:p-8">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </div>
    </article>
  );
}

function PromotionExpiry({
  promo,
  dark = false,
}: {
  promo: Promotion;
  dark?: boolean;
}) {
  if (!promo.endsAt) {
    return (
      <p
        className={
          dark
            ? "text-xs text-background/60"
            : "text-xs text-muted-foreground"
        }
      >
        <Clock
          className={`mr-1 inline h-3 w-3 ${dark ? "text-background/60" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
        Ongoing promotion
      </p>
    );
  }
  const end = new Date(promo.endsAt);
  const now = new Date();
  const expired = end < now;
  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (expired) {
    return (
      <p className="text-xs text-rose-600 dark:text-rose-400">
        <Clock className="mr-1 inline h-3 w-3" aria-hidden="true" />
        Ended {formatDate(promo.endsAt)}
      </p>
    );
  }

  return (
    <p
      className={
        dark ? "text-xs text-background/70" : "text-xs text-muted-foreground"
      }
    >
      <Clock
        className={`mr-1 inline h-3 w-3 ${dark ? "text-copper" : "text-copper"}`}
        aria-hidden="true"
      />
      {daysLeft === 0
        ? "Ends today"
        : daysLeft === 1
          ? "Ends tomorrow"
          : `Ends ${formatDate(promo.endsAt)} · ${daysLeft} days left`}
    </p>
  );
}
