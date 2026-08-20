import { Link } from "@/components/shared/Link";
import Image from "next/image";
import {
  getAllCategories,
  getFeaturedProducts,
  getNewArrivals,
  getOnSaleProducts,
  getPromotionBySlug,
  getTrendingProducts,
  isPromotionActive,
  storeInfo,
} from "@/modules/catalog/data";
import { ProductCard } from "@/components/shared/ProductCard";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  RotateCcw,
  Headphones,
  Store,
} from "lucide-react";

// ISR: catalog sections revalidate every 5 minutes so price/availability/
// offer changes propagate without making the page fully dynamic.
export const revalidate = 300;

export default async function HomePage() {
  const [categories, trending, newArrivals, editors, onSale, festive] =
    await Promise.all([
      getAllCategories(),
      getTrendingProducts(4),
      getNewArrivals(4),
      getFeaturedProducts(4),
      getOnSaleProducts(4),
      getPromotionBySlug("festive-edit"),
    ]);
  const festiveActive = festive && isPromotionActive(festive) ? festive : undefined;

  return (
    <div className="flex flex-col">
      {/* ── Hero ───────────────────────────────────────────
          Product-led. Desktop: asymmetric — text left, large product
          image right. Mobile: full-bleed product visual first, then
          proposition — intentionally art-directed, not a stacked desktop. */}
      <section className="border-b border-border">
        {/* Mobile composition: product first, proposition second */}
        <div className="lg:hidden">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
            <Image
              src="/images/hero-tech.jpg"
              alt="Premium wireless over-ear headphones — one of the products Fusion Gadgets carries"
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: "68% 50%" }}
            />
          </div>
          <div className="container-edge py-10">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px w-8 bg-copper" />
              Independent tech store · Bahraich, UP
            </p>
            <h1 className="mt-4 font-display text-[2.5rem] font-semibold leading-[1.02] tracking-tight text-balance">
              Good tech, well chosen<span className="text-copper">.</span>
            </h1>
            <p className="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground">
              Electronics, home appliances, batteries & car accessories — picked
              by people who actually use them. Local store in Bahraich, UP.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="press">
                <Link href="/shop">
                  Shop all products <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="press">
                <Link href="/categories/audio">Shop audio</Link>
              </Button>
            </div>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-5 text-sm">
              <div>
                <dt className="text-muted-foreground">Categories</dt>
                <dd className="mt-1 font-display text-xl tracking-tight">8</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Brands</dt>
                <dd className="mt-1 font-display text-xl tracking-tight">15+</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="mt-1 font-display text-xl tracking-tight">24h</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Desktop composition: asymmetric, product image dominant */}
        <div className="container-edge hidden lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:gap-0">
          <div className="flex flex-col justify-center py-20 pr-12">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px w-8 bg-copper" />
              Independent tech store · Bahraich, UP
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.75rem,4.2vw,4rem)] font-semibold leading-[1.02] tracking-tight text-balance">
              Good tech, well chosen<span className="text-copper">.</span>
            </h1>
            <p className="mt-6 max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground">
              Electronics, home appliances, batteries & car accessories — picked
              by people who actually use them. Local store in Bahraich, UP.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="press">
                <Link href="/shop">
                  Shop all products <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="press">
                <Link href="/categories/audio">Shop audio</Link>
              </Button>
            </div>
            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-border pt-6 text-sm">
              <div>
                <dt className="text-muted-foreground">Categories</dt>
                <dd className="mt-1 font-display text-2xl tracking-tight">8</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Brands</dt>
                <dd className="mt-1 font-display text-2xl tracking-tight">15+</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="mt-1 font-display text-2xl tracking-tight">24h</dd>
              </div>
            </dl>
          </div>
          <div className="relative min-h-[540px] overflow-hidden bg-muted lg:border-l lg:border-border">
            <Image
              src="/images/hero-tech.jpg"
              alt="Premium wireless over-ear headphones — one of the products Fusion Gadgets carries"
              fill
              priority
              sizes="60vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Category discovery — compact horizontal rail ── */}
      <section className="border-b border-border py-10 lg:py-12">
        <div className="container-edge">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl tracking-tight md:text-3xl">
              Shop by category
            </h2>
            <Link
              href="/categories"
              className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              All categories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Horizontal rail — scrolls within its own bounds, never the page */}
          <div
            className="mt-6 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="list"
          >
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/categories/${c.slug}`}
                role="listitem"
                className="press group relative flex h-32 w-36 shrink-0 flex-col justify-between overflow-hidden rounded-lg border border-border bg-card p-3 hover:border-copper/40 sm:h-36 sm:w-44"
                style={{ ["--accent" as string]: c.accent }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    background: `radial-gradient(120% 90% at 80% 10%, color-mix(in oklch, ${c.accent} 16%, transparent), transparent 55%)`,
                  }}
                />
                <ProductVisual
                  visualKey={c.featured[0] ? productVisualForCategory(c.slug) : "headphones"}
                  accent={c.accent}
                  className="absolute right-1 top-1/2 h-[62%] w-[62%] -translate-y-1/2 rounded-lg border-0 p-0 opacity-85 transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div className="relative">
                  <h3 className="font-display text-sm leading-tight tracking-tight">{c.name}</h3>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{c.tagline}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Most popular ────────────────────────────────── */}
      {trending.length > 0 && (
      <section className="border-b border-border py-14 lg:py-20">
        <div className="container-edge">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Popular
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
                Most popular
              </h2>
            </div>
            <Link
              href="/shop?sort=popular"
              className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex"
            >
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {trending.map((p, i) => (
              <ProductCard key={p.slug} product={p} priority={i < 2} />
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── New arrivals + Recommended ──────────────────── */}
      {(newArrivals.length > 0 || editors.length > 0) && (
      <section className="border-b border-border py-14 lg:py-20">
        <div className="container-edge">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-display text-2xl tracking-tight md:text-3xl">
                  New arrivals
                </h2>
                <Link
                  href="/shop?sort=newest"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  More →
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8">
                {newArrivals.map((p) => (
                  <ProductCard key={p.slug} product={p} compact />
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-display text-2xl tracking-tight md:text-3xl">
                  Recommended
                </h2>
                <Link
                  href="/shop"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  More →
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8">
                {editors.map((p) => (
                  <ProductCard key={p.slug} product={p} compact />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ── On sale ─────────────────────────────────────── */}
      {onSale.length > 0 && (
      <section className="border-b border-border py-14 lg:py-20">
        <div className="container-edge">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                On sale
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
                On sale
              </h2>
            </div>
            <Link
              href="/offers"
              className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex"
            >
              All offers <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {onSale.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── Festive offers banner ───────────────────────── */}
      {festiveActive && (
        <section className="border-b border-border bg-foreground text-background">
          <div className="container-edge flex flex-col items-start gap-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:py-16">
            <div className="max-w-xl">
              <span className="inline-flex items-center rounded-full bg-copper px-3 py-1 text-xs font-semibold uppercase tracking-wide text-copper-foreground">
                {festiveActive.badge}
              </span>
              <h2 className="mt-4 font-display text-3xl leading-tight tracking-tight md:text-4xl">
                {festiveActive.title}
              </h2>
              <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-background/75">
                {festiveActive.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Button asChild variant="secondary" className="press">
                <Link href="/offers">
                  Shop the offers <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── Value / trust ───────────────────────────────── */}
      <section className="border-b border-border bg-muted/40 py-14 lg:py-20">
        <div className="container-edge grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, title: "Free, fast shipping", body: "Free delivery across India on orders over ₹1,000. Most orders ship within 24 hours." },
            { icon: ShieldCheck, title: "Real warranties", body: "Up to 5-year manufacturer warranty on every product. No grey-market stock, ever." },
            { icon: RotateCcw, title: "7-day returns", body: "Changed your mind? Return within 7 days for a full refund — no friction." },
            { icon: Headphones, title: "Talk to a person", body: "Speak to someone who\u2019s actually used the product. Monday to Saturday, 10 to 7." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-3">
              <Icon className="h-6 w-6 text-copper" strokeWidth={1.5} />
              <h3 className="font-display text-lg tracking-tight">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Store presence ──────────────────────────────── */}
      <section className="border-b border-border py-14 lg:py-20">
        <div className="container-edge grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border lg:aspect-auto lg:min-h-[380px]">
            <Image
              src="/images/store-interior.jpg"
              alt="The Fusion Gadgets store in Bahraich, Uttar Pradesh"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Store className="h-4 w-4" /> Our store
            </p>
            <h2 className="mt-4 font-display text-3xl tracking-tight md:text-4xl">
              Visit us in Bahraich.
            </h2>
            <p className="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground">
              Visit our store at K.B. Global Square in Bahraich. Drop in to see
              products in person, try before you buy, get advice from people who
              know the gear, or pick up an online order. No appointment needed.
            </p>
            <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Address</dt>
                <dd className="mt-1">
                  {storeInfo.address.line1}, {storeInfo.address.line2},{" "}
                  {storeInfo.address.city}, {storeInfo.address.postcode}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Hours</dt>
                <dd className="mt-1">{storeInfo.hours}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Phone</dt>
                <dd className="mt-1">
                  <a href={`tel:${storeInfo.phone}`} className="hover:text-copper">
                    {storeInfo.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
                <dd className="mt-1">
                  <a href={`mailto:${storeInfo.email}`} className="hover:text-copper">
                    {storeInfo.email}
                  </a>
                </dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="press">
                <Link href="/contact">Get directions</Link>
              </Button>
              <Button asChild variant="ghost" className="press">
                <Link href="/about">About Fusion</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="container-edge flex flex-col items-center gap-6 text-center">
          <h2 className="font-display text-3xl tracking-tight md:text-4xl text-balance">
            Browse the full range.
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            From cables and chargers to cameras and headphones — explore
            everything we carry.
          </p>
          <Button asChild size="lg" className="press">
            <Link href="/shop">
              Shop all products <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function productVisualForCategory(slug: string) {
  const map: Record<string, ProductVisualKeyLike> = {
    audio: "headphones",
    keyboards: "keyboard",
    computing: "mouse",
    wearables: "watch",
    cameras: "camera",
    power: "charger",
    desks: "lamp",
    "gaming-carry": "controller",
  };
  return map[slug] ?? "headphones";
}

type ProductVisualKeyLike =
  | "headphones" | "earbuds" | "speaker" | "keyboard" | "mouse" | "watch"
  | "camera" | "lens" | "drone" | "charger" | "cable" | "stand" | "lamp"
  | "backpack" | "controller" | "mic" | "monitor" | "tracker";
