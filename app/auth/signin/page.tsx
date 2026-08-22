import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your Fusion Gadgets account to track orders, save favourites, and check out faster.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/auth/signin" },
};

export default function SignInPage() {
  return (
    <div className="relative isolate flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-12 sm:py-16">
      {/* Subtle warm backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_50%_-10%,oklch(0.96_0.02_55/0.6),transparent_60%)]"
      />

      {/* Back to home — top-left */}
      <Link
        href="/"
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </Link>

      <div className="w-full max-w-[420px]">
        {/* Wordmark */}
        <div className="flex justify-center">
          <Link
            href="/"
            className="font-display text-2xl font-medium tracking-tight"
            aria-label="Fusion Gadgets home"
          >
            Fusion<span className="text-copper">.</span>
          </Link>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Account
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">
            Welcome back
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            Sign in to track your orders, save your cart, and check out in
            seconds. Your details stay with us — never shared.
          </p>

          <SignInForm />

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-copper" />
            <span>
              Protected by Fusion&apos;s account safeguards.{" "}
              <Link href="/privacy" className="underline hover:text-foreground">
                Privacy
              </Link>{" "}
              ·{" "}
              <Link href="/terms" className="underline hover:text-foreground">
                Terms
              </Link>
            </span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to Fusion Gadgets?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-copper hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
