"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "@/components/shared/Link";
import { useOperation } from "@/hooks/use-operation";
import { register } from "@/services/worker";
import { errorTitle } from "@/lib/auth-errors";
import { TurnstileWidget, type TurnstileState } from "./TurnstileWidget";

// Password policy — must stay in sync with worker/src/lib/validation.ts validatePassword().
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long (max 72)")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number")
  .regex(/[^A-Za-z0-9]/, "Include at least one special character");

const schema = z
  .object({
    email: z.email("Enter a valid email address"),
    password: passwordSchema,
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

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  "1x00000000000000000000AA";

export function SignUpForm({ onRegistered }: { onRegistered: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [turnstileState, setTurnstileState] = useState<TurnstileState>("idle");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { start: startOp, stop: stopOp } = useOperation();

  const {
    register: registerField,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const terms = useWatch({ control, name: "terms" });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    if (!turnstileToken || turnstileState !== "success") {
      setServerError("Please complete the verification and try again.");
      return;
    }

    startOp("Creating your account");
    try {
      const result = await register(values.email, values.password, turnstileToken);

      stopOp();
      setTurnstileToken(null);
      setTurnstileState("expired");

      if (!result.success) {
        setServerError(result.error ?? errorTitle("SIGNUP_FAILED"));
        return;
      }

      toast.success("Account created", {
        description: "We sent a six-digit code to your email.",
      });
      onRegistered(values.email);
    } catch {
      stopOp();
      setTurnstileToken(null);
      setTurnstileState("expired");
      setServerError(errorTitle("NETWORK_ERROR"));
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
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          {...registerField("email")}
        />
        {errors.email && (
          <p id="signup-email-error" role="alert" className="text-destructive text-sm">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Min 8 chars, uppercase, number, symbol"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "signup-password-error" : "signup-password-hint"}
            className="pr-10"
            {...registerField("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {!errors.password && (
          <p id="signup-password-hint" className="text-xs text-muted-foreground">
            8+ characters with uppercase, a number, and a special character.
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
        <div className="relative">
          <Input
            id="signup-confirm"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "signup-confirm-error" : undefined}
            className="pr-10"
            {...registerField("confirmPassword")}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showConfirm ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p id="signup-confirm-error" role="alert" className="text-destructive text-sm">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
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
          onCheckedChange={(checked) => setValue("terms", checked === true)}
          aria-describedby={errors.terms ? "signup-terms-error" : undefined}
        />
        <div className="space-y-1">
          <Label htmlFor="signup-terms" className="cursor-pointer text-sm font-normal leading-snug">
            I agree to the{" "}
            <Link href="/terms" className="text-copper hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-copper hover:underline">
              Privacy Policy
            </Link>
          </Label>
          {errors.terms && (
            <p id="signup-terms-error" role="alert" className="text-destructive text-sm">
              {errors.terms.message}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={turnstileState === "loading"}
        className="press w-full bg-foreground text-background hover:bg-foreground/90"
      >
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/signin" className="font-medium text-copper hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
