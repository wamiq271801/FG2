import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import {
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  ArrowLeftRight,
  Clock,
  ArrowRight,
  Package,
} from "lucide-react";
import { storeInfo } from "@/modules/catalog/data";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Returns & warranty",
  description:
    "Fusion Gadgets returns and warranty policy: 7-day returns on unused items in original packaging, manufacturer warranties of 1–5 years, 48-hour damage reporting, and exchanges. Plain-language, no small print.",
  alternates: { canonical: "/returns" },
  openGraph: {
    title: "Returns & warranty · Fusion Gadgets",
    description:
      "7-day returns, manufacturer warranties of 1–5 years, 48-hour damage reporting. Plain-language policy.",
    url: "/returns",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Returns & warranty · Fusion Gadgets",
    description:
      "7-day returns, manufacturer warranties of 1–5 years, 48-hour damage reporting.",
  },
};

const RETURN_CONDITIONS = [
  "The item is unused, with the original manufacturer packaging intact (box, manuals, accessories, cables).",
  "It's within 7 days of delivery — we count from the courier's delivered-timestamp.",
  "It isn't a made-to-order, personalised, or engraved item (those are non-returnable by nature).",
  "Software-activated products (digital licences, downloaded DAWs) aren't returnable once redeemed.",
  "Hygiene-sensitive items (IEMs, in-ear monitors, earbuds with foam tips) are returnable only if the foam tips are unused and the original sealing sticker is intact.",
];

const WARRANTY_COVERED = [
  "Manufacturing defects in materials and workmanship",
  "Functional failures under normal use (dead pixels after the DOA window, charging faults, driver failures)",
  "Battery degradation beyond specification within the warranty period",
];

const WARRANTY_NOT_COVERED = [
  "Damage from drops, spills, liquids, or physical impact",
  "Damage from unauthorised modification, repair, or disassembly",
  "Normal wear and tear (scuffs, scratches, fabric pilling)",
  "Damage from power surges, wrong-voltage adapters, or improper charging",
  "Consumables (cables, ear pads, foam tips, batteries after the warranty window)",
];

export default function ReturnsPage() {
  return (
    <div className="container-edge py-8 lg:py-12">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Returns & warranty" }]}
      />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="mt-6 max-w-2xl">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-copper" />
          After the sale
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.04] tracking-tight text-balance md:text-5xl">
          Returns &amp; warranty.
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
          We want you to live with the thing you bought, not just unbox it.
          If it isn't right, here's how to send it back — and what's covered
          if it stops working. Plain language, no small print.
        </p>
      </header>

      {/* ── Returns policy ─────────────────────────────────── */}
      <section
        aria-labelledby="returns-heading"
        className="mt-12 border-t border-border pt-12"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
              <RotateCcw className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <h2
              id="returns-heading"
              className="mt-4 font-display text-2xl tracking-tight md:text-3xl"
            >
              Return policy.
            </h2>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              7 days, no questions asked — provided the item is in
              sellable condition.
            </p>
          </div>

          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="font-display text-lg tracking-tight">
                The window.
              </h3>
              <p className="mt-2 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
                You have <strong className="font-medium text-foreground">7 days</strong> from
                the courier's delivered-timestamp to initiate a return. We
                count from delivery, not from order placement — so shipping
                time doesn't eat into your window.
              </p>
            </div>

            <div>
              <h3 className="font-display text-lg tracking-tight">
                Conditions.
              </h3>
              <ul className="mt-3 space-y-2.5">
                {RETURN_CONDITIONS.map((c) => (
                  <li
                    key={c}
                    className="flex gap-3 text-pretty text-sm leading-relaxed text-muted-foreground"
                  >
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper"
                      aria-hidden="true"
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-display text-lg tracking-tight">
                How to start a return.
              </h3>
              <ol className="mt-3 space-y-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-copper/10 text-xs font-medium text-copper">
                    1
                  </span>
                  <span>
                    Send us a note via the{" "}
                    <Link
                      href="/contact"
                      className="font-medium text-copper underline-offset-4 hover:underline"
                    >
                      contact page
                    </Link>{" "}
                    with your order number and what's going on. The more
                    detail, the faster we can authorise the return.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-copper/10 text-xs font-medium text-copper">
                    2
                  </span>
                  <span>
                    We'll reply within one business day with a return
                    authorisation, a prepaid return label (for defective or
                    wrong-item cases), and the address to ship to.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-copper/10 text-xs font-medium text-copper">
                    3
                  </span>
                  <span>
                    Drop the package off, share the courier tracking with us,
                    and we'll refund within 3–5 business days of the package
                    arriving at the Bahraich store.
                  </span>
                </li>
              </ol>
            </div>

            <div>
              <h3 className="font-display text-lg tracking-tight">
                Refund timeline.
              </h3>
              <p className="mt-2 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
                Refunds are issued to the original payment method within{" "}
                <strong className="font-medium text-foreground">
                  3–5 business days
                </strong>{" "}
                of the returned item reaching us and passing inspection.
                Prepaid orders refund to card/UPI; COD orders refund via NEFT
                to a bank account you provide. We'll email you the moment the
                refund is initiated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Warranty ───────────────────────────────────────── */}
      <section
        aria-labelledby="warranty-heading"
        className="mt-14 border-t border-border pt-12"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <h2
              id="warranty-heading"
              className="mt-4 font-display text-2xl tracking-tight md:text-3xl"
            >
              Warranty.
            </h2>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              Every product carries its full manufacturer warranty — we
              don't strip them. The window varies by category.
            </p>
          </div>

          <div className="max-w-2xl space-y-6">
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Warranty periods by product category
                </caption>
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">
                      Warranty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="bg-card">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      Audio (headphones, IEMs, speakers)
                    </th>
                    <td className="px-5 py-3 text-right font-mono">
                      1–2 years
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      Computing (keyboards, mice, monitors)
                    </th>
                    <td className="px-5 py-3 text-right font-mono">
                      2 years
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      Cameras &amp; lenses
                    </th>
                    <td className="px-5 py-3 text-right font-mono">
                      2 years
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      Wearables
                    </th>
                    <td className="px-5 py-3 text-right font-mono">
                      1 year
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      Turntables &amp; hi-fi
                    </th>
                    <td className="px-5 py-3 text-right font-mono">
                      3 years
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      Refurbished / open-box
                    </th>
                    <td className="px-5 py-3 text-right font-mono">
                      6 months (Fusion-backed)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Exact warranty length for a specific product is printed on its
              product page and on the warranty card inside the box. Some
              accessories (cables, ear pads) carry a shorter 90-day window.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="gap-3 py-5">
                <CardHeader className="px-5">
                  <CardTitle className="font-display text-base tracking-tight">
                    What's covered
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5">
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {WARRANTY_COVERED.map((c) => (
                      <li key={c} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper"
                          aria-hidden="true"
                        />
                        <span className="text-pretty leading-relaxed">
                          {c}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="gap-3 py-5">
                <CardHeader className="px-5">
                  <CardTitle className="font-display text-base tracking-tight">
                    What's not covered
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5">
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {WARRANTY_NOT_COVERED.map((c) => (
                      <li key={c} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
                          aria-hidden="true"
                        />
                        <span className="text-pretty leading-relaxed">
                          {c}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="font-display text-lg tracking-tight">
                How to claim.
              </h3>
              <p className="mt-2 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
                Write to{" "}
                <a
                  href={`mailto:${storeInfo.supportEmail}`}
                  className="font-medium text-copper underline-offset-4 hover:underline"
                >
                  {storeInfo.supportEmail}
                </a>{" "}
                with your order number, a short description of the issue, and
                a photo or short video if you can. We'll arrange to either
                repair, replace, or initiate a warranty claim with the
                manufacturer — most claims are resolved in 7–14 business days,
                depending on parts. You don't have to chase the manufacturer
                yourself; we handle that.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Damaged / defective ────────────────────────────── */}
      <section
        aria-labelledby="damaged-heading"
        className="mt-14 border-t border-border pt-12"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
              <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <h2
              id="damaged-heading"
              className="mt-4 font-display text-2xl tracking-tight md:text-3xl"
            >
              Damaged or defective on arrival.
            </h2>
          </div>
          <div className="max-w-2xl space-y-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
            <p>
              If your order arrives damaged, or a product is dead-on-arrival
              (DOA), you have{" "}
              <strong className="font-medium text-foreground">48 hours</strong>{" "}
              from delivery to tell us. Email{" "}
              <a
                href={`mailto:${storeInfo.supportEmail}`}
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                {storeInfo.supportEmail}
              </a>{" "}
              with your order number, photos of the box and the product, and
              a short note on what's wrong.
            </p>
            <p>
              Within that 48-hour window, we'll arrange a free pickup, send a
              replacement (or a full refund, your choice), and we'll cover
              the return shipping. Outside the 48-hour window, the standard
              7-day return policy or the manufacturer warranty applies —
              whichever is relevant.
            </p>
            <p className="flex items-start gap-3 rounded-lg border border-copper/25 bg-copper/[0.04] p-4 text-sm leading-relaxed">
              <Clock
                className="mt-0.5 h-4 w-4 shrink-0 text-copper"
                aria-hidden="true"
              />
              <span>
                <span className="font-medium text-foreground">
                  Pro tip:
                </span>{" "}
                record a short unboxing video for any high-value order. It
                makes the rare damage claim frictionless.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Exchange policy ────────────────────────────────── */}
      <section
        aria-labelledby="exchange-heading"
        className="mt-14 border-t border-border pt-12"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
              <ArrowLeftRight className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <h2
              id="exchange-heading"
              className="mt-4 font-display text-2xl tracking-tight md:text-3xl"
            >
              Exchanges.
            </h2>
          </div>
          <div className="max-w-2xl space-y-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
            <p>
              Want to swap for a different colour, a different size, or a
              different product entirely? You can exchange within the same
              7-day window as returns, subject to the same conditions.
            </p>
            <p>
              The cleanest way is to return the original item for a refund
              and place a fresh order for what you actually want — that way
              you're not waiting on us to bridge inventory. If you'd rather
              we orchestrate a single swap (one pickup, one dispatch), write
              to{" "}
              <a
                href={`mailto:${storeInfo.supportEmail}`}
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                {storeInfo.supportEmail}
              </a>{" "}
              and we'll arrange it. Any price difference is settled at the
              time of exchange — refunded or invoiced.
            </p>
            <p>
              Exchanges for out-of-stock items will be held as store credit
              until the new stock lands, or refunded in full if you'd prefer
              — your call.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="mt-16 border-t border-border pt-12 lg:mt-20">
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <Package
              className="mt-0.5 h-6 w-6 shrink-0 text-copper"
              strokeWidth={1.5}
            />
            <div>
              <h2 className="font-display text-lg tracking-tight">
                Need to start a return or claim?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Send us a note with your order number — we'll take it from
                there.
              </p>
            </div>
          </div>
          <Button asChild className="press">
            <Link href="/contact">
              Open a return <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
