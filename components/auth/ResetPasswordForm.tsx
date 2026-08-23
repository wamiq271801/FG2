"use client";

/**
 * ResetPasswordForm — OTP-based password recovery.
 *
 * Flow:
 *   1. ENTER_CODE: user enters 6-digit code from email
 *   2. VERIFYING: verifyOtp({ email, token, type: "recovery" })
 *   3. SET_PASSWORD: user enters new password
 *   4. UPDATING: updateUser({ password })
 *   5. SUCCESS: password changed
 *
 * Email is received via URL search params from ForgotPasswordForm.
 * After verifyOtp succeeds, setRecoveryState("recovering") keeps the page
 * accessible via RouteGuard. After updateUser succeeds, normal auth resumes.
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/components/shared/Link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { errorTitle } from "@/lib/auth-errors";
import { useOperation } from "@/hooks/use-operation";
import { useAuthContext } from "@/providers/AuthProvider";
import { useTurnstile } from "@/providers/TurnstileProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ─── Password policy ───────────────────────────────────────────────────────
// Must stay in sync with worker/src/registration/validation.ts validatePassword().
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long (max 72)")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number")
  .regex(/[^A-Za-z0-9]/, "Include at least one special character");

const passwordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

// ─── Internal stages ───────────────────────────────────────────────────────
type Stage =
  | "enter_code"
  | "verifying"
  | "set_password"
  | "updating"
  | "success"
  | "error";

const RESEND_COOLDOWN_SECONDS = 60;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email") ?? "";

  const { recoveryState, ready, setRecoveryState } = useAuthContext();
  const { requestTurnstile } = useTurnstile();
  const [stage, setStage] = useState<Stage>("enter_code");
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { start: startOp, stop: stopOp } = useOperation();

  // Password form
  const {
    register,
    handleSubmit,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // ── Resend cooldown timer ─────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  // ── If recoveryState is already "recovering" (e.g. from PASSWORD_RECOVERY),
  //    skip straight to password stage. ──────────────────────────────────
  useEffect(() => {
    if (ready && recoveryState === "recovering" && stage === "enter_code") {
      setStage("set_password");
    }
  }, [ready, recoveryState, stage]);

  // ── Verify OTP code ──────────────────────────────────────────────────
  const handleVerifyCode = useCallback(async () => {
    if (!email || code.length < 4) return;
    setServerError(null);
    setStage("verifying");
    startOp("Verifying code");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "recovery",
      });

      stopOp();

      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (msg.includes("expired")) {
          setServerError("This code has expired. Request a new one.");
        } else if (msg.includes("invalid") || msg.includes("incorrect")) {
          setServerError("The code you entered is incorrect. Check your email and try again.");
        } else {
          setServerError("We couldn't verify that code. Please try again.");
        }
        setStage("enter_code");
        return;
      }

      // verifyOtp succeeded — session is established.
      // Set recovery state so RouteGuard keeps this page accessible.
      setRecoveryState("recovering");
      setStage("set_password");
    } catch {
      stopOp();
      setServerError("We couldn't verify that code right now. Please try again.");
      setStage("enter_code");
    }
  }, [email, code, startOp, stopOp, setRecoveryState]);

  // ── Update password ──────────────────────────────────────────────────
  const handleUpdatePassword = useCallback(
    async (values: PasswordFormValues) => {
      setServerError(null);
      setStage("updating");
      startOp("Updating password");

      try {
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({
          password: values.password,
        });

        stopOp();

        if (error) {
          const msg = error.message?.toLowerCase() ?? "";
          if (msg.includes("same password")) {
            setServerError("New password must be different from your current password.");
          } else {
            setServerError("We couldn't change your password right now. Please try again.");
          }
          setStage("set_password");
          return;
        }

        setStage("success");
      } catch {
        stopOp();
        setServerError("We couldn't change your password right now. Please try again.");
        setStage("set_password");
      }
    },
    [startOp, stopOp]
  );

  // ── Resend code ──────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (!email || resendCooldown > 0) return;
    setServerError(null);

    let turnstileToken: string;
    try {
      turnstileToken = await requestTurnstile("password_reset");
    } catch {
      setServerError("Please complete the verification and try again.");
      return;
    }

    startOp("Sending new code");

    try {
      const WORKER_BASE = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";
      const res = await fetch(`${WORKER_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken }),
      });
      const json = await res.json().catch(() => ({}));

      stopOp();

      if (!json.success) {
        setServerError("We couldn't send a new code right now. Please try again.");
        return;
      }

      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setCode("");
    } catch {
      stopOp();
      setServerError("We couldn't send a new code right now. Please try again.");
    }
  }, [email, resendCooldown, requestTurnstile, startOp, stopOp]);

  // ── Loading state ────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="mt-6 flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────
  if (stage === "success") {
    return (
      <div className="mt-6 space-y-4" role="status" aria-live="polite">
        <div className="flex items-start gap-3 rounded-lg border border-copper/30 bg-copper/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-copper" />
          <div className="text-sm leading-relaxed">
            <p className="font-medium">Your password has been changed.</p>
            <p className="mt-1 text-muted-foreground">
              You are now signed in. You can continue using your account.
            </p>
          </div>
        </div>
        <Button asChild className="press w-full bg-foreground text-background hover:bg-foreground/90">
          <Link href="/">Continue to your account</Link>
        </Button>
      </div>
    );
  }

  // ── Verifying / Updating loading state ───────────────────────────────
  if (stage === "verifying" || stage === "updating") {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {stage === "verifying" ? "Verifying your code…" : "Updating your password…"}
        </p>
      </div>
    );
  }

  // ── Set password stage ───────────────────────────────────────────────
  if (stage === "set_password") {
    return (
      <form
        onSubmit={handleSubmit(handleUpdatePassword)}
        noValidate
        className="mt-6 space-y-4"
        aria-label="Set new password form"
      >
        {serverError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <div className="relative">
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="Min 8 chars, uppercase, number, symbol"
              aria-invalid={!!passwordErrors.password}
              aria-describedby={
                passwordErrors.password ? "reset-password-error" : "reset-password-hint"
              }
              {...register("password")}
            />
          </div>
          {!passwordErrors.password && (
            <p id="reset-password-hint" className="text-xs text-muted-foreground">
              8+ characters with uppercase, a number, and a special character.
            </p>
          )}
          {passwordErrors.password && (
            <p id="reset-password-error" role="alert" className="text-destructive text-sm">
              {passwordErrors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm">Confirm new password</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-invalid={!!passwordErrors.confirmPassword}
            aria-describedby={
              passwordErrors.confirmPassword ? "reset-confirm-error" : undefined
            }
            {...register("confirmPassword")}
          />
          {passwordErrors.confirmPassword && (
            <p id="reset-confirm-error" role="alert" className="text-destructive text-sm">
              {passwordErrors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="press w-full bg-foreground text-background hover:bg-foreground/90"
        >
          Update password
        </Button>
      </form>
    );
  }

  // ── Enter code stage (default) ───────────────────────────────────────
  return (
    <div className="mt-6 space-y-4" aria-label="Enter recovery code">
      {serverError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {!email && (
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email address</Label>
          <Input
            id="reset-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      )}

      {email && (
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="reset-code">Recovery code</Label>
        <Input
          id="reset-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={!!email}
          placeholder="000000"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length >= 4) {
              e.preventDefault();
              handleVerifyCode();
            }
          }}
          aria-describedby="reset-code-hint"
        />
        <p id="reset-code-hint" className="text-xs text-muted-foreground">
          Check your email for the code. It expires in 10 minutes.
        </p>
      </div>

      <Button
        onClick={handleVerifyCode}
        disabled={code.length < 4 || !email}
        className="press w-full bg-foreground text-background hover:bg-foreground/90"
      >
        Verify code
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        Didn&apos;t receive the code?{" "}
        {resendCooldown > 0 ? (
          <span>Resend in {resendCooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="font-medium text-copper hover:underline"
          >
            Resend code
          </button>
        )}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <Link href="/auth/forgot-password" className="font-medium text-copper hover:underline">
          Try a different email
        </Link>
      </div>
    </div>
  );
}
