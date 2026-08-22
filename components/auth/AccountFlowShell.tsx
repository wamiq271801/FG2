"use client";

import { useState, useEffect } from "react";
import { Link } from "@/components/shared/Link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { VerifyForm } from "@/components/auth/VerifyForm";
import { useAuthContext } from "@/providers/AuthProvider";

type Step = "register" | "verify";

export function AccountFlowShell() {
  const router = useRouter();
  const { state: authState } = useAuthContext();
  const [step, setStep] = useState<Step>("register");
  const [registeredEmail, setRegisteredEmail] = useState("");

  useEffect(() => {
    if (authState === "authenticated") {
      router.push("/");
    } else if (authState === "unauthenticated" && step !== "verify") {
      setStep("register");
    }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [authState, router, step]);

  const handleVerified = () => {
    router.push("/");
  };

  const handleRegistered = (email: string) => {
    setRegisteredEmail(email);
    setStep("verify");
  };

  return (
    <div className="relative isolate flex min-h-[calc(100vh-9rem)] items-center justify-center px-4 py-12 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_50%_-10%,oklch(0.96_0.02_55/0.6),transparent_60%)]"
      />

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
          {step === "register" && (
            <>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Account
              </p>
              <h1 className="mt-2 font-display text-3xl tracking-tight">
                Create your account
              </h1>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                Join Fusion Gadgets to track orders, save your cart, and check out
                in seconds. We&apos;ll send a six-digit code to verify your email.
              </p>
              <SignUpForm onRegistered={handleRegistered} />
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-copper" />
                <span>
                  By creating an account you accept our{" "}
                  <Link href="/terms" className="underline hover:text-foreground">
                    Terms
                  </Link>{" "}
                  ·{" "}
                  <Link href="/privacy" className="underline hover:text-foreground">
                    Privacy
                  </Link>
                </span>
              </div>
            </>
          )}

          {step === "verify" && (
            <>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Account
              </p>
              <h1 className="mt-2 font-display text-3xl tracking-tight">
                Verify your email
              </h1>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                We sent a six-digit code to{" "}
                <span className="font-medium text-foreground">{registeredEmail}</span>.
                Enter it below to confirm your email.
              </p>
              <VerifyForm email={registeredEmail} onVerified={handleVerified} />
            </>
          )}
        </div>

        {step === "register" && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth/signin"
              className="font-medium text-copper hover:underline"
            >
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
