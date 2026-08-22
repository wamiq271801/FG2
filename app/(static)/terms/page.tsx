import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { Mail, Scale } from "lucide-react";
import { storeInfo } from "@/lib/store-info";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of sale",
  description:
    "Fusion Gadgets terms of sale — acceptance, products & pricing, orders, payment, shipping, returns, warranties, liability, intellectual property, governing law (India/Maharashtra), and contact. Last updated November 2025.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of sale · Fusion Gadgets",
    description:
      "The terms that govern buying from Fusion Gadgets — orders, payment, shipping, returns, liability, and governing law.",
    url: "/terms",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of sale · Fusion Gadgets",
    description:
      "The terms that govern buying from Fusion Gadgets — orders, payment, shipping, returns, liability, and governing law.",
  },
};

const LAST_UPDATED = "1 November 2025";

const SECTIONS = [
  { id: "acceptance", label: "Acceptance of these terms" },
  { id: "products", label: "Products & pricing" },
  { id: "orders", label: "Orders" },
  { id: "payment", label: "Payment" },
  { id: "shipping", label: "Shipping" },
  { id: "returns", label: "Returns" },
  { id: "warranties", label: "Warranties" },
  { id: "liability", label: "Limitation of liability" },
  { id: "ip", label: "Intellectual property" },
  { id: "law", label: "Governing law" },
  { id: "changes", label: "Changes to these terms" },
  { id: "contact", label: "Contact" },
];

export default function TermsPage() {
  return (
    <div className="container-edge py-8 lg:py-12">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Terms of sale" }]}
      />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="mt-6 max-w-3xl">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-copper" />
          Legal
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.04] tracking-tight text-balance md:text-5xl">
          Terms of sale.
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
          These are the terms that govern buying from {storeInfo.name}. They
          cover what you can expect from us and what we ask of you. We've
          done our best to keep them in plain English; where we use a legal
          term, we explain it.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Last updated:</span>{" "}
          <time dateTime="2025-11-01">{LAST_UPDATED}</time>
        </p>
      </header>

      {/* ── Body: TOC + prose ──────────────────────────────── */}
      <div className="mt-12 grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14">
        {/* TOC */}
        <nav
          aria-label="Sections"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            On this page
          </p>
          <ol className="mt-3 space-y-2 text-sm">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="press block rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span className="mr-2 font-mono text-xs text-copper">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Prose */}
        <article className="max-w-2xl space-y-12 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
          {/* Acceptance */}
          <section className="scroll-mt-24" id="acceptance">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Acceptance of these terms.
            </h2>
            <p className="mt-3">
              By browsing {storeInfo.name}, placing an order, or creating an
              account, you accept these terms in full. If you don't agree
              with any part of them, please don't use the shop. We may
              refuse service to anyone at our discretion, particularly where
              an order appears fraudulent or in breach of these terms.
            </p>
            <p className="mt-4">
              These terms form the entire agreement between you and{" "}
              {storeInfo.legalName} with respect to purchases made through
              the shop. They supersede any prior versions.
            </p>
          </section>

          {/* Products & pricing */}
          <section className="scroll-mt-24" id="products">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Products &amp; pricing.
            </h2>
            <p className="mt-3">
              We do our best to keep product information, images, and
              specifications accurate. Errors do happen — typos, an
              occasional wrong spec, a price that's been entered wrong. We
              reserve the right to correct errors and to alter prices
              without notice. Prices shown are inclusive of GST where
              applicable, and are in Indian Rupees (₹, INR) unless
              otherwise stated.
            </p>
            <p className="mt-4">
              If you've placed an order at a price that turns out to be
              wrong, we'll contact you before proceeding. You'll have the
              option to confirm at the correct price or cancel for a full
              refund. We won't charge a different price to your card
              without your explicit consent.
            </p>
            <p className="mt-4">
              All products are subject to availability. We don't backorder
              silently — if something's out of stock, you'll see it on the
              product page, and we'll tell you the next available date or
              offer a full refund if you'd rather not wait.
            </p>
          </section>

          {/* Orders */}
          <section className="scroll-mt-24" id="orders">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Orders.
            </h2>
            <p className="mt-3">
              Placing an order is an offer to buy. It isn't a contract
              until we accept it — which we do by emailing you an order
              confirmation with an order ID. Until that email goes out, we
              can decline an order for any reason (typically: suspected
              fraud, an obvious pricing error, or inventory that turned
              out to be wrong).
            </p>
            <p className="mt-4">
              You can cancel an order any time before it ships, no
              questions asked, for a full refund. Once it's shipped, the
              standard{" "}
              <Link
                href="/returns"
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                returns policy
              </Link>{" "}
              applies. To cancel, reply to your order confirmation email or
              write to{" "}
              <a
                href={`mailto:${storeInfo.supportEmail}`}
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                {storeInfo.supportEmail}
              </a>
              .
            </p>
            <p className="mt-4">
              Made-to-order, personalised, or engraved items can't be
              cancelled once production has begun. We'll tell you on the
              product page if that's the case, and we'll email you a clear
              heads-up before work starts.
            </p>
          </section>

          {/* Payment */}
          <section className="scroll-mt-24" id="payment">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Payment.
            </h2>
            <p className="mt-3">
              We accept UPI, all major credit and debit cards, net banking,
              and Cash on Delivery (COD) for eligible pincodes and order
              values. Payment is processed at the time of order
              confirmation, by our payment partners under PCI-DSS
              compliance. We never see or store your full card number.
            </p>
            <p className="mt-4">
              If a payment fails, no charge goes through. If you're charged
              but we don't receive a confirmation (rare, but it can happen
              with bank timeouts), write to{" "}
              <a
                href={`mailto:${storeInfo.supportEmail}`}
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                {storeInfo.supportEmail}
              </a>{" "}
              with the order details and your bank's transaction reference
              — we'll reconcile and refund within 5–7 business days if the
              order didn't go through.
            </p>
            <p className="mt-4">
              All invoices are GST-compliant where applicable. You'll receive a
              copy by email with every order; if you need a revised invoice
              with a different billing name or GSTIN, write to us within 30
              days of delivery.
            </p>
          </section>

          {/* Shipping */}
          <section className="scroll-mt-24" id="shipping">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Shipping.
            </h2>
            <p className="mt-3">
              Shipping methods, processing times, coverage, and tracking
              are detailed on our{" "}
              <Link
                href="/shipping"
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                shipping page
              </Link>
              . That page is incorporated into these terms by reference —
              i.e., the shipping policy is part of this contract.
            </p>
            <p className="mt-4">
              Title and risk in the goods pass to you on delivery. If a
              shipment is delayed beyond the courier's stated window for
              reasons outside our control (weather, strikes, government
              action), we'll work with the courier to resolve it but aren't
              liable for the delay itself.
            </p>
          </section>

          {/* Returns */}
          <section className="scroll-mt-24" id="returns">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Returns.
            </h2>
            <p className="mt-3">
              Our 7-day return policy and the conditions for return are
              detailed on our{" "}
              <Link
                href="/returns"
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                returns &amp; warranty page
              </Link>
              , which is incorporated into these terms by reference. The
              short version: 7 days from delivery for unused items in
              original packaging; refund to original payment method within
              5–7 business days of the return reaching us.
            </p>
          </section>

          {/* Warranties */}
          <section className="scroll-mt-24" id="warranties">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Warranties.
            </h2>
            <p className="mt-3">
              Products carry their manufacturer's warranty, with periods
              ranging from 1 to 5 years depending on category. Warranty
              terms, what's covered and what isn't, and the claim process
              are on our{" "}
              <Link
                href="/returns"
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                returns &amp; warranty page
              </Link>
              . That page is incorporated into these terms by reference.
            </p>
            <p className="mt-4">
              Where the manufacturer's warranty is unsatisfactory in a
              specific case, {storeInfo.name} may, at its discretion,
              offer an additional store credit or replacement — but this
              is a goodwill gesture, not a contractual obligation.
            </p>
          </section>

          {/* Liability */}
          <section className="scroll-mt-24" id="liability">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Limitation of liability.
            </h2>
            <p className="mt-3">
              To the fullest extent permitted by law, {storeInfo.legalName}'s
              total liability for any claim arising out of or relating to a
              purchase is limited to the amount you paid for the product
              that gave rise to the claim. We are not liable for
              indirect, incidental, consequential, or punitive damages,
              including loss of profits, data, or goodwill.
            </p>
            <p className="mt-4">
              Nothing in these terms limits liability that cannot be
              limited under applicable law — for instance, liability for
              death or personal injury caused by negligence, or for fraud
              or fraudulent misrepresentation.
            </p>
            <p className="mt-4">
              You are responsible for using products in accordance with
              their instructions and applicable law. We aren't liable for
              damage arising from misuse, modification, or use outside the
              product's intended purpose.
            </p>
          </section>

          {/* IP */}
          <section className="scroll-mt-24" id="ip">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Intellectual property.
            </h2>
            <p className="mt-3">
              The {storeInfo.name} name, logo, wordmark, site design,
              copy, photography, and product imagery are the property of{" "}
              {storeInfo.legalName} or our licensors, and are protected by
              Indian and international intellectual-property law. You may
              not reproduce, redistribute, or use any of it commercially
              without our written permission.
            </p>
            <p className="mt-4">
              Product names, brand names, and trademarks remain the
              property of their respective owners and are used here for
              identification only. We are not affiliated with or endorsed
              by any brand unless explicitly stated.
            </p>
            <p className="mt-4">
              You're welcome to share links to our pages, quote short
              excerpts in reviews, and use our images for personal,
              non-commercial purposes. If you'd like to use anything for
              editorial or commercial work, write to{" "}
              <a
                href={`mailto:${storeInfo.email}`}
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                {storeInfo.email}
              </a>
              .
            </p>
          </section>

          {/* Governing law */}
          <section className="scroll-mt-24" id="law">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Governing law.
            </h2>
            <p className="mt-3">
              These terms and any dispute arising out of or relating to
              them are governed by the laws of India. Specifically, the
              courts of Bahraich, Uttar Pradesh have exclusive jurisdiction over
              any disputes — though we'd always prefer to resolve things
              amicably first, by writing to{" "}
              <a
                href={`mailto:${storeInfo.email}`}
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                {storeInfo.email}
              </a>
              .
            </p>
            <p className="mt-4">
              If any provision of these terms is found to be unenforceable,
              the rest remains in full force. Our failure to enforce a
              provision in any one instance isn't a waiver of our right to
              enforce it in the future.
            </p>
          </section>

          {/* Changes */}
          <section className="scroll-mt-24" id="changes">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Changes to these terms.
            </h2>
            <p className="mt-3">
              We may revise these terms from time to time. When we do,
              we'll update the &ldquo;last updated&rdquo; date at the top
              of the page. For material changes, we'll notify you by email
              and post a notice on the homepage at least 14 days before
              the change takes effect.
            </p>
            <p className="mt-4">
              Continued use of the shop after a change takes effect
              constitutes acceptance of the updated terms. If you don't
              agree, please stop using the shop and write to us for a
              refund of any pending orders.
            </p>
          </section>

          {/* Contact */}
          <section className="scroll-mt-24" id="contact">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Contact.
            </h2>
            <p className="mt-3">
              Questions about these terms? Write to us:
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="flex items-start gap-2">
                <Mail
                  className="mt-0.5 h-4 w-4 shrink-0 text-copper"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-medium text-foreground">Email:</span>{" "}
                  <a
                    href={`mailto:${storeInfo.email}`}
                    className="font-medium text-copper underline-offset-4 hover:underline"
                  >
                    {storeInfo.email}
                  </a>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Scale
                  className="mt-0.5 h-4 w-4 shrink-0 text-copper"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-medium text-foreground">
                    Registered office:
                  </span>{" "}
                  {storeInfo.legalName}, {storeInfo.address.line1},{" "}
                  {storeInfo.address.line2}, {storeInfo.address.city},{" "}
                  {storeInfo.address.state} {storeInfo.address.postcode},{" "}
                  {storeInfo.address.country}.
                </span>
              </p>
            </div>
            <div className="mt-6">
              <Button asChild variant="outline" className="press">
                <Link href="/contact">
                  Contact us
                </Link>
              </Button>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
