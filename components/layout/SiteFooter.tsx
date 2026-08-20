import { Link } from "@/components/shared/Link";
import { Instagram, Twitter, Youtube, MapPin, Phone, Mail } from "lucide-react";
import { getAllCategories, storeInfo } from "@/modules/catalog/data";

const helpLinks = [
  { href: "/shipping", label: "Shipping" },
  { href: "/returns", label: "Returns & warranty" },
  { href: "/contact", label: "Contact us" },
  { href: "/orders", label: "Track order" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of sale" },
];

export async function SiteFooter() {
  const categories = (await getAllCategories()).slice(0, 6);
  return (
    <footer className="mt-auto border-t border-border bg-muted/40">
      {/* Newsletter */}
      <div className="border-b border-border">
        <div className="container-edge grid gap-6 py-10 md:grid-cols-2 md:items-center md:gap-12">
          <div>
            <h2 className="font-display text-2xl tracking-tight md:text-3xl">
              New arrivals, restocks, and offers.
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Hear about new products, restocks, and seasonal offers. No spam,
              unsubscribe anytime.
            </p>
          </div>
          <form
            action="/api/newsletter"
            method="post"
            className="flex w-full max-w-md flex-col gap-2 sm:flex-row md:ml-auto"
          >
            <label htmlFor="footer-email" className="sr-only">
              Email address
            </label>
            <input
              id="footer-email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-copper focus:ring-2 focus:ring-copper/20"
            />
            <button
              type="submit"
              className="press h-11 rounded-md bg-foreground px-5 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>

      {/* Main footer */}
      <div className="container-edge grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Link href="/" className="font-display text-lg font-medium">
            Fusion<span className="text-copper">.</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            {storeInfo.tagline}
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {storeInfo.address.line1}, {storeInfo.address.line2},{" "}
                {storeInfo.address.city}, {storeInfo.address.state}{" "}
                {storeInfo.address.postcode}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" />
              <a href={`tel:${storeInfo.phone}`} className="hover:text-foreground">
                {storeInfo.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              <a href={`mailto:${storeInfo.email}`} className="hover:text-foreground">
                {storeInfo.email}
              </a>
            </li>
          </ul>
          <div className="flex items-center gap-3 pt-1">
            <a href={storeInfo.social.instagram} aria-label="Instagram" className="text-muted-foreground hover:text-foreground">
              <Instagram className="h-5 w-5" />
            </a>
            <a href={storeInfo.social.twitter} aria-label="Twitter / X" className="text-muted-foreground hover:text-foreground">
              <Twitter className="h-5 w-5" />
            </a>
            <a href={storeInfo.social.youtube} aria-label="YouTube" className="text-muted-foreground hover:text-foreground">
              <Youtube className="h-5 w-5" />
            </a>
          </div>
        </div>

        <nav aria-label="Shop">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Shop
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="text-foreground/80 hover:text-copper"
                >
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/offers" className="text-foreground/80 hover:text-copper">
                Offers
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Help">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Help
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {helpLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-foreground/80 hover:text-copper">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Account
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/account" className="text-foreground/80 hover:text-copper">My account</Link></li>
            <li><Link href="/orders" className="text-foreground/80 hover:text-copper">Order history</Link></li>
            <li><Link href="/cart" className="text-foreground/80 hover:text-copper">Bag</Link></li>
            <li><Link href="/auth/signin" className="text-foreground/80 hover:text-copper">Sign in</Link></li>
          </ul>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="container-edge flex flex-col items-center justify-between gap-3 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {storeInfo.legalName}. Made in
            Bahraich, Uttar Pradesh.
          </p>
          <div className="flex items-center gap-4">
            {legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
