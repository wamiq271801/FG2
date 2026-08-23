"use client";

/**
 * ResetPasswordForm — Set a new password during a Supabase recovery session.
 *
 * This is STEP B of the password-reset flow:
 *   A: Request reset email (ForgotPasswordForm → Worker /auth/reset-password)
 *   B: Set new password (ResetPasswordForm → supabase.auth.updateUser)
 *
 * The recovery session is established by Supabase when the user clicks
 * the recovery link from their email. This form only handles the actual
 * password update.
 *
 * Auth state:
 *   - Recovery session detected by AuthProvider (PASSWORD_RECOVERY event)
 *   - RouteGuard allows access only during recovery session
 *   - No Turnstile required (user is already inside a valid recovery session)
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/components/shared/Link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { errorTitle } from "@/lib/auth-errors";
import { useOperation } from "@/hooks/use-operation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Password policy — must stay in sync with worker/src/registration/validation.ts validatePassword().
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long (max 72)")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number")
  .regex(/[^A-Za-z0-9]/, "Include at least one special character");

const schema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const { start: startOp, stop: stopOp } = useOperation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Check if there's a valid recovery session on mount
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error || !data.session) {
          setSessionValid(false);
          return;
        }

        // Session exists — the recovery session is valid
        setSessionValid(true);
      } catch {
        if (mounted) setSessionValid(false);
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    startOp("Updating password");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      stopOp();

      if (error) {
        // Handle specific Supabase errors
        if (error.message?.includes("expired") || error.message?.includes("invalid")) {
          setServerError("This password reset link has expired. Please request a new one.");
        } else if (error.message?.includes("same password")) {
          setServerError("New password must be different from your current password.");
        } else {
          setServerError(errorTitle("SIGNUP_FAILED"));
        }
        return;
      }

      // Password updated successfully
      // The PASSWORD_RECOVERY session will transition to normal authenticated state
      // via the AuthProvider's onAuthStateChange listener
      setDone(true);
    } catch {
      stopOp();
      setServerError(errorTitle("NETWORK_ERROR"));
    }
  };

  // Loading state while checking session
  if (sessionValid === null) {
    return (
      <div className="mt-6 flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Invalid/expired recovery session
  if (!sessionValid) {
    return (
      <div
        className="mt-6 space-y-4"
        role="alert"
        aria-labelledby="reset-expired-title"
      >
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm leading-relaxed">
            <p id="reset-expired-title" className="font-medium">
              This password reset link is invalid or has expired.
            </p>
            <p className="mt-1 text-muted-foreground">
              Reset links expire after 30 minutes for security. Please request
              a new link to continue.
            </p>
          </div>
        </div>

        <Button asChild className="press w-full bg-foreground text-background hover:bg-foreground/90">
          <Link href="/auth/forgot-password">Request a new reset link</Link>
        </Button>

        <Button asChild variant="ghost" className="press w-full">
          <Link href="/auth/signin">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  // Success state
  if (done) {
    return (
      <div
        className="mt-6 space-y-4"
        aria-labelledby="reset-success-title"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3 rounded-lg border border-copper/30 bg-copper/5 p-4">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-copper" />
          <div className="text-sm leading-relaxed">
            <p id="reset-success-title" className="font-medium">
              Your password has been updated.
            </p>
            <p className="mt-1 text-muted-foreground">
              You are now signed in. You can continue using your account.
            </p>
          </div>
        </div>

        <Button asChild className="press w-full bg-foreground text-background hover:bg-foreground/90">
          <Link href="/">Continue to shop</Link>
        </Button>
      </div>
    );
  }

  // Password reset form
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 space-y-4"
      aria-label="Choose new password form"
    >
      {serverError && (
        <Alert variant="destructive" id="reset-server-error" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="reset-password">New password</Label>
        <div className="relative">
          <Input
            id="reset-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            placeholder="Min 8 chars, uppercase, number, symbol"
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? "reset-password-error" : "reset-password-hint"
            }
            className="pr-10"
            {...register("password")}
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
          <p id="reset-password-hint" className="text-xs text-muted-foreground">
            8+ characters with uppercase, a number, and a special character.
          </p>
        )}
        {errors.password && (
          <p
            id="reset-password-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm">Confirm new password</Label>
        <div className="relative">
          <Input
            id="reset-confirm"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "reset-confirm-error" : undefined}
            className="pr-10"
            {...register("confirmPassword")}
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
          <p
            id="reset-confirm-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={!!serverError}
        className="press w-full bg-foreground text-background hover:bg-foreground/90"
      >
        Update password
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/auth/signin" className="font-medium text-copper hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
