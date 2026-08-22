import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import {
  Phone,
  MessageCircle,
  Mail,
  Clock,
  MapPin,
  TrainFront,
  ArrowRight,
  Package,
  Headphones,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { storeInfo } from "@/lib/store-info";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactForm } from "@/components/cms/ContactForm";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Talk to the people behind Fusion Gadgets. Phone, WhatsApp, email, or send us a message — we read everything within one business day. Visit our store in Bahraich, Uttar Pradesh.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact us · Fusion Gadgets",
    description:
      "Phone, WhatsApp, email, or send a message. We read everything within one business day.",
    url: "/contact",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact us · Fusion Gadgets",
    description:
      "Phone, WhatsApp, email, or send a message. We read everything within one business day.",
  },
};

const CONTACT_METHODS = [
  {
    icon: Phone,
    label: "Phone",
    value: storeInfo.phone,
    href: `tel:${storeInfo.phone.replace(/\s+/g, "")}`,
    note: "Mon–Fri 9–8, Sat 10–6 IST. We pick up ourselves.",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: storeInfo.whatsapp,
    href: `https://wa.me/${storeInfo.whatsapp.replace(/[^0-9]/g, "")}`,
    note: "Fastest for order questions. Replies within an hour during store hours.",
  },
  {
    icon: Mail,
    label: "Email",
    value: storeInfo.email,
    href: `mailto:${storeInfo.email}`,
    note: "For anything detailed — bulk orders, partnerships, press.",
  },
  {
    icon: Clock,
    label: "Hours",
    value: storeInfo.hours,
    note: "Closed Sundays & public holidays. IST throughout.",
  },
];

const SUPPORT_CATEGORIES = [
  {
    icon: Package,
    title: "Orders & tracking",
    body: "Where's my order, can I change my address, when will it arrive.",
    href: "/orders",
    cta: "Track order",
  },
  {
    icon: Headphones,
    title: "Product questions",
    body: "Which product for my use, what's in the box, compatibility questions.",
    href: "/shop",
    cta: "Browse the shop",
  },
  {
    icon: RotateCcw,
    title: "Returns & warranty",
    body: "7-day returns, manufacturer warranties, damaged-on-arrival reports.",
    href: "/returns",
    cta: "Read the policy",
  },
];

const HOURS_ROWS = [
  { day: "Monday", hours: "09:00 – 20:00" },
  { day: "Tuesday", hours: "09:00 – 20:00" },
  { day: "Wednesday", hours: "09:00 – 20:00" },
  { day: "Thursday", hours: "09:00 – 20:00" },
  { day: "Friday", hours: "09:00 – 20:00" },
  { day: "Saturday", hours: "10:00 – 18:00" },
  { day: "Sunday", hours: "Closed", closed: true },
];

export default function ContactPage() {
  return (
    <div className="container-edge py-8 lg:py-12">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="mt-6 max-w-2xl">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-copper" />
          Talk to us
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.04] tracking-tight text-balance md:text-5xl">
          Contact us.
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground md:text-base">
          We're a small team in Bahraich — a tight crew at the K.B. Global
          Square store. There's no robot between you and an answer. Pick
          whatever channel suits you; we read everything within one business
          day, usually a lot sooner.
        </p>
      </header>

      {/* ── Contact methods grid ───────────────────────────── */}
      <section
        aria-labelledby="methods-heading"
        className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <h2 id="methods-heading" className="sr-only">
          Contact methods
        </h2>
        {CONTACT_METHODS.map(({ icon: Icon, label, value, href, note }) => (
          <Card
            key={label}
            className="h-full gap-3 py-5 transition-colors hover:border-copper/40"
          >
            <CardHeader className="gap-2 px-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <CardTitle className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              {href ? (
                <a
                  href={href}
                  className="press font-mono text-sm font-medium text-foreground hover:text-copper"
                >
                  {value}
                </a>
              ) : (
                <p className="font-mono text-sm font-medium">{value}</p>
              )}
              <p className="mt-2 text-pretty text-xs leading-relaxed text-muted-foreground">
                {note}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ── Form + location ────────────────────────────────── */}
      <section
        aria-labelledby="form-heading"
        className="mt-12 grid gap-10 border-t border-border pt-12 lg:mt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14"
      >
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
            Send a message
          </p>
          <h2
            id="form-heading"
            className="mt-3 font-display text-2xl tracking-tight md:text-3xl"
          >
            Tell us what you need.
          </h2>
          <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            The more context, the better — order numbers, what you've already
            tried, what you're trying to do. We'll get back to you within one
            business day.
          </p>

          <div className="mt-6">
            <ContactForm />
          </div>
        </div>

        {/* Location + map */}
        <aside aria-labelledby="location-heading" className="space-y-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
              The store
            </p>
            <h2
              id="location-heading"
              className="mt-3 font-display text-2xl tracking-tight md:text-3xl"
            >
              Bahraich, Uttar Pradesh.
            </h2>
          </div>

          <Card className="overflow-hidden py-0">
            <div className="aspect-[4/3] w-full border-b border-border bg-muted">
              <iframe
                title="Fusion Gadgets store location on OpenStreetMap"
                src={storeInfo.mapEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0 grayscale-[0.15]"
              />
            </div>
            <CardContent className="space-y-4 p-6">
              <div className="flex gap-3">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-copper"
                  aria-hidden="true"
                />
                <div className="text-sm leading-relaxed">
                  <p className="font-medium">
                    {storeInfo.legalName}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {storeInfo.address.line1}, {storeInfo.address.line2}
                    <br />
                    {storeInfo.address.city}, {storeInfo.address.state}{" "}
                    {storeInfo.address.postcode}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <TrainFront
                  className="mt-0.5 h-4 w-4 shrink-0 text-copper"
                  aria-hidden="true"
                />
                <div className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Getting here:
                  </span>{" "}
                  Bahraich railway station, ~10 min by auto. We're near K.B.
                  Global Square in the civil lines area — easy to find and
                  easy to reach by road.
                </div>
              </div>
              <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                K.B. Global Square is well-connected — if you're visiting in
                the evening, allow a little extra time. Two-wheeler and car
                parking is available right outside the store.
              </p>
              <Button
                asChild
                variant="outline"
                className="press mt-1 w-full"
              >
                <a
                  href="https://www.openstreetmap.org/?mlat=27.5744&mlon=81.5989#map=16/27.5744/81.5989"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="h-4 w-4" />
                  Open in OpenStreetMap
                </a>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>

      {/* ── Business hours ─────────────────────────────────── */}
      <section
        aria-labelledby="hours-heading"
        className="mt-16 border-t border-border pt-12 lg:mt-20"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
              When we're around
            </p>
            <h2
              id="hours-heading"
              className="mt-3 font-display text-2xl tracking-tight md:text-3xl"
            >
              Business hours.
            </h2>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              Walk-ins welcome. If you'd like extra time to compare products,
              message ahead — we'll set things up for you.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Fusion Gadgets business hours, Indian Standard Time
              </caption>
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 text-left font-medium">
                    Day
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Hours (IST)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {HOURS_ROWS.map((row) => (
                  <tr key={row.day} className="bg-card">
                    <th
                      scope="row"
                      className="px-5 py-3 text-left font-medium"
                    >
                      {row.day}
                    </th>
                    <td
                      className={`px-5 py-3 text-right font-mono ${
                        row.closed ? "text-muted-foreground" : ""
                      }`}
                    >
                      {row.hours}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Support categories ─────────────────────────────── */}
      <section
        aria-labelledby="support-heading"
        className="mt-16 border-t border-border pt-12 lg:mt-20"
      >
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
            Help yourself
          </p>
          <h2
            id="support-heading"
            className="mt-3 font-display text-2xl tracking-tight md:text-3xl"
          >
            Common questions.
          </h2>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            Sometimes the fastest answer is the one you find yourself. Here's
            where to look first.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SUPPORT_CATEGORIES.map(({ icon: Icon, title, body, href, cta }) => (
            <Card key={title} className="gap-3 py-5">
              <CardHeader className="gap-2 px-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-copper/10 text-copper">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <CardTitle className="font-display text-base tracking-tight">
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
                <Button
                  asChild
                  variant="link"
                  className="press mt-3 h-auto p-0 text-copper"
                >
                  <Link href={href}>
                    {cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Reassurance ────────────────────────────────────── */}
      <section className="mt-16 border-t border-border pt-12 lg:mt-20">
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 md:flex-row md:items-center md:gap-5">
          <ShieldCheck className="h-6 w-6 shrink-0 text-copper" strokeWidth={1.5} />
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              We don't outsource support.
            </span>{" "}
            Every message is read by someone in the Bahraich store. If you'd
            rather talk to a person, call{" "}
            <a
              href={`tel:${storeInfo.phone.replace(/\s+/g, "")}`}
              className="font-medium text-copper underline-offset-4 hover:underline"
            >
              {storeInfo.phone}
            </a>{" "}
            during store hours — we'll pick up.
          </p>
        </div>
      </section>
    </div>
  );
}
