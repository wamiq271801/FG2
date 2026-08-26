import type { Metadata } from "next";
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

const siteUrl = "https://fusiongadgets.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
    url: siteUrl,
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
    </html>
  );
}
