import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import {
  Truck,
  Zap,
  Bike,
  PackageCheck,
  MapPinned,
  Search,
  Globe2,
  Package,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { storeInfo } from "@/modules/catalog/data";

export const metadata: Metadata = {
  title: "Shipping",
  description:
    "How Fusion Gadgets ships across India — standard (free over ₹1,000, else ₹99), express, and local delivery within Bahraich. Processing times, coverage, tracking, and packaging notes.",
  alternates: { canonical: "/shipping" },
  openGraph: {
    title: "Shipping · Fusion Gadgets",
    description:
      "Standard, express, and local Bahraich delivery. Free over ₹1,000. Pan-India coverage via Blue Dart, Delhivery, DTDC, FedEx.",
    url: "/shipping",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shipping · Fusion Gadgets",
    description:
      "Standard, express, and local Bahraich delivery. Free over ₹1,000. Pan-India coverage via Blue Dart, Delhivery, DTDC, FedEx.",
  },
};

const SHIPPING_METHODS = [
  {
    icon: Truck,
    name: "Standard",
    price: "Free over ₹1,000 · else ₹99",
    eta: "1–7 business days (metro faster)",
    description:
      "Our default. Insured, tracked end-to-end, and shipped via our partners (Blue Dart, Delhivery, DTDC, or FedEx).",
    badge: "Most common",
  },
  {
    icon: Zap,
    name: "Express",
    price: "₹199",
    eta: "1–2 business days",
    description:
      "Air-freighted to metro and tier-1 pincodes. Order before 14:00 IST and we'll usually dispatch the same day.",
  },
  {
    icon: Bike,
    name: "Local delivery · Bahraich",
    price: "₹299",
    eta: "Same day, if ordered before 13:00 IST",
    description:
      "Within Bahraich & nearby areas. We dispatch from our Bahraich store; you'll have it by evening.",
    badge: "Bahraich & nearby",
  },
];

const PROCESSING = [
  {
    label: "In-stock items",
    body: "Packed and dispatched within 24 hours of order confirmation. Most in-stock orders leave the same day if placed before 14:00 IST.",
  },
  {
    label: "Made-to-order & preorders",
    body: "Products marked made-to-order or preorder have their lead time printed on the product page — usually 2–3 weeks. We'll email you a more precise ship date once the workshop confirms.",
  },
  {
    label: "Personalised items",
    body: "Anything custom-engraved or built-to-spec ships after the personalisation window closes. Cancellations aren't possible once work has begun.",
  },
];

const TOC = [
  { href: "#methods", label: "Shipping methods" },
  { href: "#processing", label: "Processing time" },
  { href: "#coverage", label: "Coverage" },
  { href: "#tracking", label: "Tracking" },
  { href: "#international", label: "International" },
  { href: "#packaging", label: "Packaging" },
];

export default function ShippingPage() {
  return (
    <div className="container-edge py-8 lg:py-12">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Shipping" }]}
      />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="mt-6 max-w-2xl">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-copper" />
          Delivery
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.04] tracking-tight text-balance md:text-5xl">
          Shipping.
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
          Every order leaves our Bahraich store — packed by hand, insured in
          transit, and tracked end-to-end. Standard shipping is free above
          ₹1,000; below that, a flat ₹99. Within Bahraich & nearby areas,
          we can get it to you the same day.
        </p>
      </header>

      {/* ── In-page nav ────────────────────────────────────── */}
      <nav
        aria-label="On this page"
        className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-y border-border py-3 text-sm"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          On this page
        </span>
        {TOC.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="text-muted-foreground underline-offset-4 hover:text-copper hover:underline"
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* ── Methods ───────────────────────────────────────── */}
      <section
        aria-labelledby="methods-heading"
        className="mt-12 scroll-mt-8"
        id="methods"
      >
        <h2
          id="methods-heading"
          className="font-display text-2xl tracking-tight md:text-3xl"
        >
          Shipping methods.
        </h2>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Pick a method at checkout. Free shipping above ₹1,000 applies
          automatically to the standard option.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {SHIPPING_METHODS.map(
            ({ icon: Icon, name, price, eta, description, badge }) => (
              <Card key={name} className="relative h-full gap-4 py-5">
                {badge && (
                  <span className="absolute right-4 top-4 rounded-full bg-copper/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-copper">
                    {badge}
                  </span>
                )}
                <CardHeader className="gap-3 px-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <CardTitle className="font-display text-lg tracking-tight">
                    {name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-5 text-sm">
                  <p className="font-mono text-sm font-medium text-foreground">
                    {price}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {eta}
                  </p>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </section>

      {/* ── Processing ─────────────────────────────────────── */}
      <section
        aria-labelledby="processing-heading"
        className="mt-14 scroll-mt-8 border-t border-border pt-12"
        id="processing"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <h2
              id="processing-heading"
              className="font-display text-2xl tracking-tight md:text-3xl"
            >
              Processing time.
            </h2>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              How long it takes us to pack and dispatch — separate from how
              long the courier takes to deliver.
            </p>
          </div>
          <ul className="space-y-5">
            {PROCESSING.map((item) => (
              <li key={item.label} className="flex gap-4">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-copper"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-display text-base tracking-tight">
                    {item.label}
                  </h3>
                  <p className="mt-1 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Coverage ───────────────────────────────────────── */}
      <section
        aria-labelledby="coverage-heading"
        className="mt-14 scroll-mt-8 border-t border-border pt-12"
        id="coverage"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
              <MapPinned className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <h2
              id="coverage-heading"
              className="mt-4 font-display text-2xl tracking-tight md:text-3xl"
            >
              Coverage.
            </h2>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              Pan-India. We ship to every serviceable pincode in the country.
            </p>
          </div>
          <div className="max-w-2xl space-y-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
            <p>
              We deliver to all 28 states and 8 union territories. Metro
              pincodes are 1–3 days on standard shipping; tier-2 cities take
              3–5 days; other areas take 5–7 days.
            </p>
            <p>
              If a pincode isn't serviceable by our primary couriers (Blue
              Dart, Delhivery, DTDC, FedEx), we'll let you know at checkout —
              we won't take an order we can't deliver.
            </p>
            <p>
              COD is available on most pincodes for orders under ₹15,000. For
              larger orders or restricted pincodes, prepaid is the only
              option — we'll tell you at checkout.
            </p>
          </div>
        </div>
      </section>

      {/* ── Tracking ───────────────────────────────────────── */}
      <section
        aria-labelledby="tracking-heading"
        className="mt-14 scroll-mt-8 border-t border-border pt-12"
        id="tracking"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
              <Search className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <h2
              id="tracking-heading"
              className="mt-4 font-display text-2xl tracking-tight md:text-3xl"
            >
              Tracking.
            </h2>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              Where your order is, right now.
            </p>
          </div>
          <div className="max-w-2xl space-y-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
            <p>
              The moment your order ships, you'll get an email and a
              WhatsApp message with the courier name and tracking ID. The
              same ID is visible in your{" "}
              <Link
                href="/orders"
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                order history
              </Link>{" "}
              — sign in, open the order, and you'll see live status alongside
              each step.
            </p>
            <p>
              We update tracking at three points: when the order is packed,
              when the courier picks it up, and when it's out for delivery.
              If a delivery attempt fails, the courier will try twice more on
              consecutive working days before holding the package at the
              nearest hub for pickup.
            </p>
            <p>
              If your tracking hasn't moved in 48 hours, write to us at{" "}
              <a
                href={`mailto:${storeInfo.supportEmail}`}
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                {storeInfo.supportEmail}
              </a>{" "}
              — we'll chase the courier directly.
            </p>
            <div className="pt-2">
              <Button asChild variant="outline" className="press">
                <Link href="/orders">
                  <PackageCheck className="h-4 w-4" />
                  Track an order
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── International ──────────────────────────────────── */}
      <section
        aria-labelledby="international-heading"
        className="mt-14 scroll-mt-8 border-t border-border pt-12"
        id="international"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
              <Globe2 className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <h2
              id="international-heading"
              className="mt-4 font-display text-2xl tracking-tight md:text-3xl"
            >
              International shipping.
            </h2>
          </div>
          <div className="max-w-2xl">
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-5">
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  Not available, currently.
                </span>{" "}
                We ship only within India for now — the import and duties
                paperwork for cross-border electronics is more than we want
                to ask a customer to deal with.
              </p>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                If you're outside India and there's something you really
                want, write to us at{" "}
                <a
                  href={`mailto:${storeInfo.email}`}
                  className="font-medium text-copper underline-offset-4 hover:underline"
                >
                  {storeInfo.email}
                </a>{" "}
                — occasionally we can arrange a one-off shipment through a
                freight forwarder you nominate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Packaging ──────────────────────────────────────── */}
      <section
        aria-labelledby="packaging-heading"
        className="mt-14 scroll-mt-8 border-t border-border pt-12"
        id="packaging"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
              <Package className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <h2
              id="packaging-heading"
              className="mt-4 font-display text-2xl tracking-tight md:text-3xl"
            >
              Packaging notes.
            </h2>
          </div>
          <ul className="max-w-2xl space-y-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
            <li className="flex gap-3">
              <span
                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-copper"
                aria-hidden="true"
              />
              <span>
                Every order ships in a double-walled corrugated box with the
                product in its original manufacturer packaging inside. We
                don't use poly mailers for anything fragile.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-copper"
                aria-hidden="true"
              />
              <span>
                Void fill is paper-based — honeycomb kraft and shredded
                cardboard. No plastic peanuts, no bubble wrap unless the
                manufacturer specifies it.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-copper"
                aria-hidden="true"
              />
              <span>
                Fragile items (turntables, monitor speakers, glass lenses)
                get an extra sleeve and a FRAGILE sticker on two faces. If
                anything arrives damaged, report it within 48 hours — see{" "}
                <Link
                  href="/returns"
                  className="font-medium text-copper underline-offset-4 hover:underline"
                >
                  returns &amp; warranty
                </Link>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-copper"
                aria-hidden="true"
              />
              <span>
                The outer box is unbranded — no "Fusion Gadgets" on the
                outside, for discretion and security. A small card with a
                handwritten note goes inside, if we have something to say.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ── Cross-link CTA ─────────────────────────────────── */}
      <section className="mt-16 border-t border-border pt-12 lg:mt-20">
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-lg tracking-tight">
              Need help with a delivery?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Write to us — we'll chase it down.
            </p>
          </div>
          <Button asChild variant="outline" className="press">
            <Link href="/contact">
              Contact support <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
