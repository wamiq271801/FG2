import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import Image from "next/image";
import {
  ArrowRight,
  Headphones,
  Keyboard,
  Camera,
  LampDesk,
  ShieldCheck,
  Ear,
  Store,
  MapPin,
  Clock,
  Quote,
} from "lucide-react";
import { storeInfo } from "@/modules/catalog/data";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About Fusion Gadgets",
  description:
    "Fusion Gadgets is your trusted local store for electronics, home appliances, batteries, and car accessories — founded in 2024 in Bahraich, Uttar Pradesh. 100% authentic products, genuine warranties, people who know the gear.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Fusion Gadgets",
    description:
      "A trusted local store for electronics, home appliances, batteries & car accessories. Founded 2024 in Bahraich, UP.",
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Fusion Gadgets",
    description:
      "A trusted local store for electronics, home appliances, batteries & car accessories. Founded 2024 in Bahraich, UP.",
  },
};

const OFFERINGS = [
  {
    icon: Headphones,
    title: "Electronics",
    body: "Everyday electronics from brands we'd actually recommend — not a long tail of forgettable SKUs. 100% authentic, every unit.",
  },
  {
    icon: Keyboard,
    title: "Home appliances",
    body: "Appliances that keep a household running. Reliable units, genuine warranties, and local after-sales support.",
  },
  {
    icon: Camera,
    title: "Batteries",
    body: "Batteries sourced from authorised distributors, with the genuine warranty to match. The right cell for the right job.",
  },
  {
    icon: LampDesk,
    title: "Car accessories",
    body: "Practical additions for the daily commute. Tested, genuinely useful, and worth the shelf space.",
  },
];

const TRUST = [
  {
    icon: ShieldCheck,
    title: "Real warranties",
    body: "Every product carries its genuine manufacturer warranty from authorised distributors — 100% authentic, every time. We handle the paperwork, not just the box.",
  },
  {
    icon: Ear,
    title: "Curated, not catalogued",
    body: "If we wouldn't use it ourselves, we don't sell it. Inventory is small on purpose — curation is the whole job.",
  },
  {
    icon: Store,
    title: "People who know the gear",
    body: "A small team that knows electronics, appliances, batteries, and car accessories. We answer the phone ourselves.",
  },
];

export default function AboutPage() {
  return (
    <div className="container-edge py-8 lg:py-12">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "About" }]}
      />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mt-6 grain overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col justify-center gap-5 p-8 lg:p-12">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px w-8 bg-copper" />
              Bahraich · Est. {storeInfo.founded}
            </p>
            <h1 className="font-display text-4xl leading-[1.04] tracking-tight text-balance md:text-5xl lg:text-6xl">
              We sell less, on purpose.
            </h1>
            <p className="max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
              Fusion Gadgets is a small store in Bahraich for electronics,
              home appliances, batteries, and car accessories — a counter at
              K.B. Global Square where you can hold the product before you buy
              it, and ask someone who actually knows.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button asChild className="press" size="lg">
                <Link href="/shop">
                  Browse the shop <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="press" size="lg">
                <Link href="/contact">
                  <MapPin className="h-4 w-4" />
                  Visit us
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative min-h-[280px] overflow-hidden border-t border-border lg:border-l lg:border-t-0">
            <Image
              src="/images/store-interior.jpg"
              alt="The Fusion Gadgets store in Bahraich — electronics, home appliances, batteries and car accessories on display"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/25 via-transparent to-transparent" />
            <p className="absolute bottom-4 left-4 right-4 rounded-lg bg-background/85 px-3 py-2 text-xs text-foreground backdrop-blur-sm">
              The Bahraich store — open six days a week, by walk-in or
              appointment.
            </p>
          </div>
        </div>
      </section>

      {/* ── Origin story ─────────────────────────────────────── */}
      <section className="mt-16 border-t border-border pt-12 lg:mt-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
              Origin
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight md:text-4xl">
              An online store that became a Bahraich shop.
            </h2>
          </div>
          <div className="max-w-2xl space-y-5 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
            <p>
              Fusion Gadgets started in {storeInfo.founded}, as a small online
              store. A tech enthusiast in Bahraich, tired of the gap between
              what was available locally and what people actually needed,
              wanted a place where you could buy electronics, home appliances,
              batteries, and car accessories without second-guessing
              authenticity or warranty. So they started keeping a shelf.
            </p>
            <p>
              The first version wasn't much — a short catalogue, a WhatsApp
              number, and a willingness to answer questions at length. People
              kept coming back, and they kept bringing their friends. Within
              months, what started as a side project had outgrown a phone
              screen.
            </p>
            <p>
              By late {storeInfo.founded}, we'd opened a physical store at
              K.B. Global Square in Bahraich — a real counter, real shelves,
              and a real place to come back to if something wasn't right. The
              shape of the business changed; the rule didn't. If we wouldn't
              recommend it to a friend, it doesn't make the catalogue.
            </p>
            <p>
              We're still small on purpose. A small team in the Bahraich
              store, sourcing from authorised distributors and handling every
              order ourselves. Every product is genuine, every warranty is
              real, and every order leaves the same store you'd visit if you
              lived down the street.
            </p>
          </div>
        </div>
      </section>

      {/* ── What we offer ────────────────────────────────────── */}
      <section
        aria-labelledby="offerings-heading"
        className="mt-16 border-t border-border pt-12 lg:mt-20"
      >
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
            What we offer
          </p>
          <h2
            id="offerings-heading"
            className="mt-3 font-display text-3xl leading-tight tracking-tight md:text-4xl"
          >
            Four shelves, each one earned.
          </h2>
          <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">
            We don't carry everything — we carry what we'd use ourselves. The
            catalogue is small enough that we can tell you, in detail, why
            each thing is here.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OFFERINGS.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-copper/10 text-copper">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <h3 className="font-display text-lg tracking-tight">{title}</h3>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Why trust us ─────────────────────────────────────── */}
      <section
        aria-labelledby="trust-heading"
        className="mt-16 border-t border-border pt-12 lg:mt-20"
      >
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
            Why trust us
          </p>
          <h2
            id="trust-heading"
            className="mt-3 font-display text-3xl leading-tight tracking-tight md:text-4xl"
          >
            Small enough to be accountable.
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TRUST.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
            >
              <Icon className="h-6 w-6 text-copper" strokeWidth={1.5} />
              <h3 className="font-display text-lg tracking-tight">{title}</h3>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── The team / the room ──────────────────────────────── */}
      <section
        aria-labelledby="team-heading"
        className="mt-16 border-t border-border pt-12 lg:mt-20"
      >
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
              The store
            </p>
            <h2
              id="team-heading"
              className="mt-3 font-display text-3xl leading-tight tracking-tight md:text-4xl"
            >
              A Bahraich store, six days a week.
            </h2>
            <div className="mt-5 space-y-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
              <p>
                The store at K.B. Global Square is small — about the size of a
                generous living room — and most of it is given over to a
                single purpose: a clean, well-lit counter where you can hold
                the product, check the specs, and ask someone who actually
                knows. Electronics on one wall, home appliances on another,
                batteries and car accessories on the shelves behind.
              </p>
              <p>
                A small team runs the floor — the same people who pick the
                catalogue, answer the phone, and pack the online orders. None
                of us works on commission. We get paid the same whether you
                walk out with the ₹500 battery or the ₹50,000 appliance — only
                whether we sent you home with the right thing.
              </p>
              <p>
                If you're buying something you'll live with for years, come by
                for an hour. Bring a list of what you need. We'll walk you
                through it.
              </p>
            </div>
          </div>

          <aside
            aria-labelledby="visit-aside"
            className="rounded-xl border border-border bg-card p-6 lg:p-7"
          >
            <h3
              id="visit-aside"
              className="font-display text-xl tracking-tight"
            >
              Come say hello.
            </h3>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex gap-3">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-copper"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-muted-foreground">Address</dt>
                  <dd className="mt-0.5 leading-relaxed">
                    {storeInfo.address.line1}, {storeInfo.address.line2}
                    <br />
                    {storeInfo.address.city}, {storeInfo.address.state}{" "}
                    {storeInfo.address.postcode}
                    <br />
                    {storeInfo.address.country}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock
                  className="mt-0.5 h-4 w-4 shrink-0 text-copper"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-muted-foreground">Hours</dt>
                  <dd className="mt-0.5 leading-relaxed">{storeInfo.hours}</dd>
                  <dd className="mt-0.5 text-muted-foreground">
                    Closed Sundays &amp; public holidays
                  </dd>
                </div>
              </div>
            </dl>
            <Button asChild className="press mt-5 w-full">
              <Link href="/contact">
                Plan a visit <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </aside>
        </div>
      </section>

      {/* ── Pull quote ───────────────────────────────────────── */}
      <section className="mt-16 border-t border-border pt-12 lg:mt-20">
        <figure className="mx-auto max-w-3xl text-center">
          <Quote
            className="mx-auto h-8 w-8 text-copper"
            strokeWidth={1.25}
            aria-hidden="true"
          />
          <blockquote className="mt-4 font-display text-2xl leading-snug tracking-tight text-balance md:text-3xl">
            “The best gear disappears. You stop thinking about it and just
            listen, or type, or shoot. That's what we're looking for — and
            it's the only thing we put on the shelf.”
          </blockquote>
          <figcaption className="mt-4 text-sm text-muted-foreground">
            The team · {storeInfo.name}
          </figcaption>
        </figure>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="mt-16 border-t border-border pt-12 lg:mt-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-card p-8 lg:flex-row lg:items-center lg:p-10">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl tracking-tight md:text-3xl">
              Come find the thing that disappears.
            </h2>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              Browse the catalogue online, or stop by the Bahraich store and
              see the range for yourself. Either way, we'll be here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="press" size="lg">
              <Link href="/shop">
                Browse the shop <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="press" size="lg">
              <Link href="/contact">Visit us</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
