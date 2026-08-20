"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "@/components/shared/Link";
import { useOperation } from "@/hooks/use-operation";
import { register as requestAuthorization } from "@/services/worker";
import { createClient } from "@/lib/supabase/client";
import { TurnstileWidget, type TurnstileState } from "./TurnstileWidget";

const schema = z
  .object({
    fullName: z.string().min(2, "Please enter your name (2+ characters)"),
    email: z.email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Password is too long (max 72)"),
    confirmPassword: z.string(),
    terms: z
      .boolean()
      .refine((v) => v === true, "Please accept the terms to continue"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

type FormValues = z.infer<typeof schema>;

// Public Turnstile site key (safe for the browser). The matching secret lives
// only on the Worker. Falls back to a Cloudflare always-passes test key when
// unset so the form remains functional in local dev without real keys.
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  "1x00000000000000000000AA"; // Cloudflare test site key (always passes)

export function SignUpForm({ onRegistered }: { onRegistered: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [turnstileState, setTurnstileState] = useState<TurnstileState>("idle");
  // Token held in component state (memory only — never persisted). Cleared
  // immediately after the signUp attempt so it can never be reused.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { start: startOp, stop: stopOp } = useOperation();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const terms = useWatch({ control, name: "terms" });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    // The Turnstile token must be fresh and present before we proceed.
    if (!turnstileToken || turnstileState !== "success") {
      setServerError("Please complete the verification and try again.");
      return;
    }

    startOp("Creating your account");
    try {
      // Step 1: Worker gate — verify Turnstile, issue one-time authorization.
      const authzResult = await requestAuthorization(
        values.email,
        values.password,
        turnstileToken
      );

      if (!authzResult.success || !authzResult.authorization) {
        stopOp();
        // Turnstile tokens are single-use; a stale token cannot be retried.
        // Clear so the user must complete a fresh challenge.
        setTurnstileToken(null);
        setTurnstileState("expired");
        setServerError(authzResult.error ?? "Unable to create account. Please try again.");
        return;
      }

      const authorization = authzResult.authorization;

      // Step 2: native Supabase signUp. Pass the same Turnstile token as
      // captchaToken (Supabase verifies CAPTCHA) AND the opaque Worker
      // authorization in signup metadata (the Before User Created hook
      // validates + consumes it). The authorization exists only in memory
      // for this single call.
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          captchaToken: turnstileToken,
          data: {
            full_name: values.fullName,
            reg_auth: authorization,
          },
        },
      });

      stopOp();

      // Token has been consumed by the signUp attempt — never reuse it.
      setTurnstileToken(null);

      if (error) {
        // Common cases: email already registered, hook rejection, expired auth.
        const msg = error.message ?? "";
        if (/already|exists|registered/i.test(msg)) {
          setServerError("An account with this email already exists.");
          return;
        }
        if (/signup is not authorized|registration session expired|not authorized/i.test(msg)) {
          setServerError("Your registration session expired. Please submit the form again.");
          setTurnstileState("expired");
          return;
        }
        setServerError(msg || "Unable to create account. Please try again.");
        setTurnstileState("expired");
        return;
      }

      // signUp returns a user object even before email confirmation. If the
      // session is null, OTP confirmation is required (the normal flow).
      if (!data?.user) {
        setServerError("Unable to create account. Please try again.");
        setTurnstileState("expired");
        return;
      }

      toast.success("Account created", {
        description: "We've sent a verification code to your email.",
      });
      onRegistered(values.email);
    } catch {
      stopOp();
      // Network failure or Worker unreachable. No fallback direct signup.
      setTurnstileToken(null);
      setTurnstileState("expired");
      setServerError("Network error. Please try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 space-y-4"
      aria-label="Create account form"
    >
      {serverError && (
        <Alert variant="destructive" id="signup-server-error" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="name"
          autoFocus
          placeholder="Riya Sharma"
          aria-invalid={!!errors.fullName}
          aria-describedby={errors.fullName ? "signup-name-error" : undefined}
          {...register("fullName")}
        />
        {errors.fullName && (
          <p id="signup-name-error" role="alert" className="text-destructive text-sm">
            {errors.fullName.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="signup-email-error" role="alert" className="text-destructive text-sm">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "signup-password-error" : "signup-password-hint"}
          {...register("password")}
        />
        {!errors.password && (
          <p id="signup-password-hint" className="text-xs text-muted-foreground">
            Use 8+ characters with a mix of letters, numbers and symbols.
          </p>
        )}
        {errors.password && (
          <p id="signup-password-error" role="alert" className="text-destructive text-sm">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-confirm">Confirm password</Label>
        <Input
          id="signup-confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "signup-confirm-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p id="signup-confirm-error" role="alert" className="text-destructive text-sm">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Verify you&apos;re human</Label>
        <TurnstileWidget
          siteKey={TURNSTILE_SITE_KEY}
          onToken={setTurnstileToken}
          onStateChange={setTurnstileState}
        />
      </div>

      <div className="flex items-start gap-2 pt-1">
        <Checkbox
          id="signup-terms"
          checked={terms}
          onCheckedChange={(v) =>
            setValue("terms", v === true, { shouldDirty: true })
          }
          aria-invalid={!!errors.terms}
          aria-describedby={errors.terms ? "signup-terms-error" : undefined}
          className="mt-0.5"
        />
        <Label
          htmlFor="signup-terms"
          className="text-sm font-normal leading-relaxed text-muted-foreground"
        >
          I agree to Fusion&apos;s{" "}
          <Link href="/terms" className="font-medium text-copper hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-medium text-copper hover:underline">
            Privacy Policy
          </Link>
          .
        </Label>
      </div>
      {errors.terms && (
        <p id="signup-terms-error" role="alert" className="text-destructive text-sm">
          {errors.terms.message}
        </p>
      )}

      <Button
        type="submit"
        className="press w-full bg-foreground text-background hover:bg-foreground/90"
      >
        Create account
      </Button>
    </form>
  );
}
