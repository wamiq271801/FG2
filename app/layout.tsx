import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { CartProvider } from "@/providers/CartProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { TurnstileProvider } from "@/providers/TurnstileProvider";
import { RouteGuard } from "@/providers/RouteGuard";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { OperationOverlay } from "@/components/shared/OperationOverlay";
import { cn } from "@/lib/utils";
import { SITE_ORIGIN } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Fusion Gadgets — Considered tech, for everyday life",
    template: "%s · Fusion Gadgets",
  },
  description:
    "Shop electronics, home appliances, power banks, smartwatches, headphones, inverter batteries, car batteries & more at Fusion Gadgets. Your trusted local store in Bahraich, Uttar Pradesh. Visit us or call +91 88587 63010.",
  keywords: [
    "Fusion Gadgets",
    "electronics store Bahraich",
    "home appliances",
    "power banks",
    "smartwatches",
    "headphones",
    "inverter batteries",
    "car batteries",
    "car accessories",
    "Uttar Pradesh",
  ],
  authors: [{ name: "Fusion Gadgets" }],
  creator: "Fusion Gadgets",
  publisher: "Fusion Gadgets",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_ORIGIN,
    siteName: "Fusion Gadgets",
    title: "Fusion Gadgets — Electronics, Home Appliances & Utility Gadgets Store in Bahraich",
    description:
      "Electronics, home appliances, batteries, car accessories & gadgets. Local store in Bahraich, UP.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fusion Gadgets — Electronics, Home Appliances & Utility Gadgets Store in Bahraich",
    description:
      "Electronics, home appliances, batteries, car accessories & gadgets. Local store in Bahraich, UP.",
  },
  icons: {
    icon: "/logo.svg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "shopping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Suspense ABOVE <body> — the official Cache Components opt-in for
          fully dynamic rendering (see dynamic-rendering.js: hasSuspenseAbove
          Body — "an explicit signal from the user that they acknowledge the
          empty shell and want dynamic rendering"). With this boundary in
          place, routes whose pages await uncached data directly (instead of
          hiding it behind per-page `<Suspense fallback={null}>` holes)
          render COMPLETELY on the server per request: the document is
          rendered in full and returned — no empty-shell-first, no streamed
          content sections. Pages that are fully static/cached still
          prerender as before (nothing suspends, so this boundary resolves
          and disappears from their output). During client navigation the
          pending destination page suspends here at an already-committed
          boundary, so React retains the current page until the new one is
          fully rendered — the shared layout, header and footer stay mounted
          and stable (no blank main, no footer jump, no scroll jump). */}
      <Suspense fallback={null}>
        <body
          className={cn(
            geistSans.variable,
            geistMono.variable,
            fraunces.variable,
            "antialiased bg-background text-foreground min-h-screen flex flex-col font-sans"
          )}
        >
          <AuthProvider>
            <TurnstileProvider>
              <CartProvider>
                <RouteGuard>
                  <a
                    href="#main"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
                  >
                    Skip to content
                  </a>
                  <NavigationProgress />
                  <SiteHeader />
                  <main id="main" className="flex-1">
                    {children}
                  </main>
                  <OperationOverlay />
                </RouteGuard>
              </CartProvider>
            </TurnstileProvider>
          </AuthProvider>
          <Sonner />
        </body>
      </Suspense>
    </html>
  );
}
