import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  description:
    "Set a new password for your Fusion Gadgets account using the secure link from your reset email.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/auth/reset-password" },
};

export default function ResetPasswordPage() {
  return (
    <div className="relative isolate flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-12 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_50%_-10%,oklch(0.96_0.02_55/0.6),transparent_60%)]"
      />

      <Link
        href="/"
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </Link>

      <div className="w-full max-w-[420px]">
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
            Choose a new password
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            Pick a strong password you haven&apos;t used before. Once you update
            it, all your other devices will need to sign in again.
          </p>

          <ResetPasswordForm />

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-copper" />
            <span>
              We never store passwords in plain text.{" "}
              <Link
                href="/privacy"
                className="underline hover:text-foreground"
              >
                Privacy
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
