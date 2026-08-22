import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
  description:
    "Enter your account email and we'll send you a secure link to reset your Fusion Gadgets password.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/auth/forgot-password" },
};

export default function ForgotPasswordPage() {
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
            Reset your password
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            Enter the email tied to your Fusion account and we&apos;ll send a
            secure link to choose a new password. The link expires in 30
            minutes.
          </p>

          <ForgotPasswordForm />

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <MailCheck className="h-3.5 w-3.5 text-copper" />
            <span>
              We won&apos;t reveal whether an email has an account.{" "}
              <Link href="/privacy" className="underline hover:text-foreground">
                Privacy
              </Link>
            </span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link
            href="/auth/signin"
            className="font-medium text-copper hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
