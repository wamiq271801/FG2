import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { Mail, ShieldCheck } from "lucide-react";
import { storeInfo } from "@/lib/store-info";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { JsonLd } from "@/components/shared/JsonLd";
import { buildJsonLdGraph, webPageEntity } from "@/lib/schema";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Fusion Gadgets collects, uses, and protects your personal information — what we collect, how we use it, cookies, your rights, data retention, and contact. Last updated November 2025.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy policy · Fusion Gadgets",
    description:
      "What we collect, how we use it, cookies, your rights, and how to contact us about your data.",
    url: "/privacy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy policy · Fusion Gadgets",
    description:
      "What we collect, how we use it, cookies, your rights, and how to contact us about your data.",
  },
};

const LAST_UPDATED = "1 November 2025";

const SECTIONS = [
  { id: "collect", label: "What we collect" },
  { id: "use", label: "How we use it" },
  { id: "sharing", label: "Sharing" },
  { id: "cookies", label: "Cookies" },
  { id: "rights", label: "Your rights" },
  { id: "retention", label: "Data retention" },
  { id: "children", label: "Children's privacy" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact" },
];

export default function PrivacyPage() {
  return (
    <div className="container-edge py-8 lg:py-12">
      <JsonLd
        data={buildJsonLdGraph(
          webPageEntity({
            path: "/privacy",
            name: "Privacy policy",
            description:
              "How Fusion Gadgets collects, uses, and protects your personal information — what we collect, how we use it, cookies, your rights, data retention, and contact.",
          })
        )}
      />
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Privacy policy" }]}
      />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="mt-6 max-w-3xl">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-copper" />
          Legal
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.04] tracking-tight text-balance md:text-5xl">
          Privacy policy.
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
          We try to keep this readable. The short version: we collect what we
          need to ship your order and answer your messages, we don't sell
          your data to anyone, and you can ask for a copy or a deletion
          anytime. The longer version is below.
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
          {/* What we collect */}
          <section className="scroll-mt-24" id="collect">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              What we collect.
            </h2>
            <p className="mt-3">
              We collect the minimum needed to run the shop. Specifically:
            </p>
            <ul className="mt-4 space-y-2.5">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Account info:
                  </span>{" "}
                  name, email address, and a hashed password when you create
                  an account.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Order info:
                  </span>{" "}
                  shipping address, phone number (for delivery and courier
                  updates), and the items you've bought.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Payment info:
                  </span>{" "}
                  we never see or store your full card number. Payments are
                  processed by our payment partners (Razorpay, Stripe) under
                  PCI-DSS compliance. We retain only the last four digits and
                  a transaction reference for your records.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Messages:
                  </span>{" "}
                  anything you send us via the contact form, email, or
                  WhatsApp — we keep these to provide support and to maintain
                  a record of what was discussed.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Usage data:
                  </span>{" "}
                  anonymised analytics (pages viewed, device type, rough
                  location at city level) to understand what's working on the
                  site.
                </span>
              </li>
            </ul>
          </section>

          {/* How we use it */}
          <section className="scroll-mt-24" id="use">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              How we use it.
            </h2>
            <p className="mt-3">
              Your information is used to:
            </p>
            <ul className="mt-4 space-y-2.5">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>Process and ship your orders, and handle returns and warranty claims.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>Reply to your messages and provide product support.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  Send you order confirmations, shipping updates, and
                  transactional emails you need (password resets, etc.).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  Send the occasional newsletter — only if you've explicitly
                  opted in, and only until you unsubscribe.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  Prevent fraud and abuse of the store — flagging suspicious
                  orders, chargeback patterns, etc.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  Meet our legal obligations — issuing GST invoices, retaining
                  transaction records, responding to lawful requests.
                </span>
              </li>
            </ul>
          </section>

          {/* Sharing */}
          <section className="scroll-mt-24" id="sharing">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Sharing.
            </h2>
            <p className="mt-3">
              We don't sell your data. We don't share it with marketers. We
              share the minimum required with:
            </p>
            <ul className="mt-4 space-y-2.5">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Couriers
                  </span>{" "}
                  (Blue Dart, Delhivery, India Post) — your name, address,
                  phone, and the package contents for customs declarations.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Payment processors
                  </span>{" "}
                  (Razorpay, Stripe) — only what's needed to authorise and
                  settle the transaction.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Manufacturers
                  </span>{" "}
                  — only when you file a warranty claim, and only the
                  information they need to honour it.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Authorities
                  </span>{" "}
                  — where we are legally required to, in response to a valid
                  court order or lawful request from a competent authority.
                </span>
              </li>
            </ul>
            <p className="mt-4">
              We use a small number of service providers (hosting, email
              delivery, analytics) who process data on our behalf under
              written agreements. They're bound to use your data only to
              provide the service we've hired them for.
            </p>
          </section>

          {/* Cookies */}
          <section className="scroll-mt-24" id="cookies">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Cookies.
            </h2>
            <p className="mt-3">
              We use cookies and similar storage for three things:
            </p>
            <ul className="mt-4 space-y-2.5">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Essential:
                  </span>{" "}
                  keeping you signed in, holding your cart between visits.
                  These can't be turned off without breaking the shop.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Analytics:
                  </span>{" "}
                  privacy-respecting analytics (no cross-site tracking, no
                  personal identifiers) so we know which pages work.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">
                    Preferences:
                  </span>{" "}
                  remembering things like your currency or theme. Strictly
                  first-party, never shared.
                </span>
              </li>
            </ul>
            <p className="mt-4">
              We do not use advertising cookies or retargeting pixels. Most
              browsers let you refuse or delete cookies; the shop will still
              work, you'll just have to sign in again and re-add items to
              your cart.
            </p>
          </section>

          {/* Your rights */}
          <section className="scroll-mt-24" id="rights">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Your rights.
            </h2>
            <p className="mt-3">
              Under Indian data-protection law (the Digital Personal Data
              Protection Act, 2023) and the GDPR (for visitors in the EU/UK),
              you have the right to:
            </p>
            <ul className="mt-4 space-y-2.5">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Access</span> —
                  ask for a copy of the personal data we hold about you.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Correct</span> —
                  fix anything that's wrong or out of date.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Delete</span> —
                  ask us to erase your data (subject to legal record-keeping
                  obligations, e.g., GST invoices).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Withdraw consent</span> —
                  unsubscribe from the newsletter, opt out of non-essential
                  cookies, withdraw consent for marketing at any time.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Portability</span> —
                  receive your data in a structured, machine-readable format.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Object</span> —
                  to processing for direct marketing or our legitimate
                  interests.
                </span>
              </li>
            </ul>
            <p className="mt-4">
              To exercise any of these, write to{" "}
              <a
                href={`mailto:${storeInfo.email}`}
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                {storeInfo.email}
              </a>
              . We'll respond within 30 days, often sooner. If you're not
              satisfied with our response, you have the right to lodge a
              complaint with the Data Protection Board of India or your local
              data-protection authority.
            </p>
          </section>

          {/* Data retention */}
          <section className="scroll-mt-24" id="retention">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Data retention.
            </h2>
            <p className="mt-3">
              We hold your data for as long as we have a reason to:
            </p>
            <ul className="mt-4 space-y-2.5">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Account data</span> —
                  until you ask us to delete it, or 36 months after your last
                  login, whichever comes first.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Order records</span> —
                  7 years, as required under Indian tax law (GST retention).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Support messages</span> —
                  up to 24 months, so we can refer back if a related question
                  comes up.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Warranty claims</span> —
                  for the length of the warranty plus 12 months.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-copper" />
                <span>
                  <span className="font-medium text-foreground">Newsletter</span> —
                  until you unsubscribe. We honour unsubscribes immediately.
                </span>
              </li>
            </ul>
          </section>

          {/* Children's privacy */}
          <section className="scroll-mt-24" id="children">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Children&apos;s privacy.
            </h2>
            <p className="mt-3">
              The shop is not directed at children under 18, and we don't
              knowingly collect personal information from anyone under 18. If
              you believe a minor has provided us with personal data, please
              write to{" "}
              <a
                href={`mailto:${storeInfo.email}`}
                className="font-medium text-copper underline-offset-4 hover:underline"
              >
                {storeInfo.email}
              </a>{" "}
              and we'll delete it.
            </p>
          </section>

          {/* Changes */}
          <section className="scroll-mt-24" id="changes">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Changes to this policy.
            </h2>
            <p className="mt-3">
              We may update this policy from time to time. When we do, we'll
              revise the &ldquo;last updated&rdquo; date at the top of the
              page. For material changes — anything that affects how we use
              your data or your rights — we'll notify you by email and post a
              notice on the homepage at least 14 days before the change
              takes effect.
            </p>
            <p className="mt-4">
              Continued use of the shop after a change takes effect means you
              accept the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section className="scroll-mt-24" id="contact">
            <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
              Contact.
            </h2>
            <p className="mt-3">
              Questions about this policy or your data? Write to us:
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
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-copper"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-medium text-foreground">
                    Data Protection Officer:
                  </span>{" "}
                  {storeInfo.legalName}, {storeInfo.address.line1},{" "}
                  {storeInfo.address.line2}, {storeInfo.address.city},{" "}
                  {storeInfo.address.state} {storeInfo.address.postcode}
                </span>
              </p>
            </div>
            <div className="mt-6">
              <Button asChild variant="outline" className="press">
                <Link href="/contact">
                  Open a data request
                </Link>
              </Button>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
