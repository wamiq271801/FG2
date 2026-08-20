"use client";

import { useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOperation } from "@/hooks/use-operation";
import { resendSignupOtp } from "@/services/worker";

export function VerifyForm({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const { start: startOp, stop: stopOp } = useOperation();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    setClientError(null);

    if (!/^\d{6}$/.test(code)) {
      setClientError("Enter the 6-digit code from your email.");
      return;
    }

    setSubmitting(true);
    startOp("Verifying your email");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      stopOp();

      if (error) {
        const msg = error.message ?? "";
        if (/expired/i.test(msg)) {
          setServerError("That code has expired. Request a new one below.");
        } else {
          setServerError("That code didn't match. Please try again.");
        }
        setSubmitting(false);
        return;
      }

      toast.success("Email verified", {
        description: "Your account is ready — welcome to Fusion.",
      });
      onVerified();
    } catch {
      stopOp();
      setServerError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      const result = await resendSignupOtp(email);
      if (!result.success) {
        toast.error("Couldn't resend", {
          description: result.error ?? "Please try again in a minute.",
        });
      } else {
        toast.success("Code sent", {
          description: "A fresh 6-digit code is on its way to your inbox.",
        });
        setCode("");
        setServerError(null);
        setClientError(null);
      }
    } catch {
      toast.error("Network error", {
        description: "Please try again.",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-6 space-y-5"
      aria-label="Verify email form"
    >
      {serverError && (
        <Alert variant="destructive" id="verify-server-error" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <span id="verify-code-label" className="text-sm font-medium leading-none">
          6-digit verification code
        </span>
        <div className="flex justify-center pt-1">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            aria-label="6-digit verification code"
            aria-describedby={clientError ? "verify-code-error" : "verify-code-hint"}
            aria-invalid={!!clientError}
            containerClassName="justify-center"
            autoFocus
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <p id="verify-code-hint" className="text-center text-xs text-muted-foreground">
          We sent this to {email}. It expires in 10 minutes.
        </p>
        {clientError && (
          <p id="verify-code-error" role="alert" className="text-center text-sm text-destructive">
            {clientError}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="press w-full bg-foreground text-background hover:bg-foreground/90"
      >
        {submitting ? (
          <>
            <Loader2 className="animate-spin" />
            Verifying…
          </>
        ) : (
          "Verify email"
        )}
      </Button>

      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <p className="text-sm text-muted-foreground">Didn&apos;t get the code?</p>
        <Button
          type="button"
          variant="ghost"
          onClick={onResend}
          disabled={resending || submitting}
          className="press h-auto px-2 py-1 text-sm font-medium text-copper hover:bg-copper/5 hover:text-copper"
        >
          {resending ? (
            <>
              <Loader2 className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <RotateCw className="h-3.5 w-3.5" />
              Resend code
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
