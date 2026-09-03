import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Fusion Gadgets Admin",
    template: "%s · FG Admin",
  },
  description: "Private catalog and review management tool.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
