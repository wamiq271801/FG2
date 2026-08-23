"use client";

import { useState } from "react";
import { Link } from "@/components/shared/Link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { requestPasswordReset } from "@/services/worker";
import { errorTitle } from "@/lib/auth-errors";
import { useTurnstile } from "@/providers/TurnstileProvider";

const schema = z.object({
  email: z.email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { requestTurnstile } = useTurnstile();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      let turnstileToken: string;
      try {
        turnstileToken = await requestTurnstile("password_reset");
      } catch {
        setServerError("Please complete the verification and try again.");
        setSubmitting(false);
        return;
      }

      const result = await requestPasswordReset(values.email, turnstileToken);
      if (!result.success) {
        setServerError(result.error ?? errorTitle("RESET_FAILED"));
        setSubmitting(false);
        return;
      }

      setSentTo(values.email);
      toast.success("Reset link sent");
    } catch {
      setServerError(errorTitle("NETWORK_ERROR"));
      setSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <div
        className="mt-6 space-y-4"
        aria-labelledby="forgot-success-title"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3 rounded-lg border border-copper/30 bg-copper/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-copper" />
          <div className="text-sm leading-relaxed">
            <p id="forgot-success-title" className="font-medium">
              If an account exists for{" "}
              <span className="font-medium text-foreground">{sentTo}</span>, a
              recovery code is on its way.
            </p>
            <p className="mt-1 text-muted-foreground">
              Check your email for the 6-digit code. It expires in 10 minutes.
            </p>
          </div>
        </div>

        <Button asChild className="press w-full bg-foreground text-background hover:bg-foreground/90">
          <Link href={`/auth/reset-password?email=${encodeURIComponent(sentTo)}`}>
            Enter recovery code
          </Link>
        </Button>

        <Button asChild variant="ghost" className="press w-full">
          <Link href="/auth/signin">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 space-y-4"
      aria-label="Request password reset form"
    >
      {serverError && (
        <Alert variant="destructive" id="forgot-server-error" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "forgot-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p
            id="forgot-email-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.email.message}
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
            Sending link…
          </>
        ) : (
          "Send reset link"
        )}
      </Button>
    </form>
  );
}
