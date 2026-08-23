"use client";

/**
 * ForgotPasswordForm — single-controller password-reset flow.
 *
 * Stages:
 *   REQUEST_EMAIL  → email input + Turnstile + Worker request
 *   ENTER_CODE     → 6-digit OTP entry + verify
 *   VERIFYING_CODE → loading
 *   SET_PASSWORD   → new password + confirm
 *   UPDATING_PASSWORD → loading
 *   SUCCESS        → done
 *
 * The user remains on /auth/forgot-password throughout.
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "@/components/shared/Link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { requestPasswordReset } from "@/services/worker";
import { errorTitle } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { useTurnstile } from "@/providers/TurnstileProvider";
import { useAuthContext } from "@/providers/AuthProvider";
import { useOperation } from "@/hooks/use-operation";

// ── Email form schema ──
const emailSchema = z.object({
  email: z.email("Enter a valid email address"),
});
type EmailFormValues = z.infer<typeof emailSchema>;

// ── Password form schema ──
const passwordFormSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Password is too long (max 72)")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number")
      .regex(/[^A-Za-z0-9]/, "Include at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

// ── Flow stages ──
type Stage =
  | "request_email"
  | "enter_code"
  | "verifying"
  | "set_password"
  | "updating"
  | "success";

const RESEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordForm() {
  const { requestTurnstile } = useTurnstile();
  const { setRecoveryState } = useAuthContext();
  const { start: startOp, stop: stopOp } = useOperation();

  const [stage, setStage] = useState<Stage>("request_email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Email form ──
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  // ── Password form ──
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // ── Resend cooldown timer ──
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  // ── STEP 1: Request reset code ──
  const handleRequestEmail = useCallback(
    async (values: EmailFormValues) => {
      setServerError(null);

      let turnstileToken: string;
      try {
        turnstileToken = await requestTurnstile("password_reset");
      } catch {
        setServerError("Please complete the verification and try again.");
        return;
      }

      startOp("Sending code");
      try {
        const result = await requestPasswordReset(values.email, turnstileToken);
        stopOp();

        if (!result.success) {
          setServerError(result.error ?? errorTitle("RESET_FAILED"));
          return;
        }

        setEmail(values.email);
        setStage("enter_code");
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success("Recovery code sent");
      } catch {
        stopOp();
        setServerError(errorTitle("NETWORK_ERROR"));
      }
    },
    [requestTurnstile, startOp, stopOp]
  );

  // ── STEP 2: Verify OTP code ──
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
          setServerError(
            "The code you entered is incorrect. Check your email and try again."
          );
        } else {
          setServerError("We couldn't verify that code. Please try again.");
        }
        setStage("enter_code");
        return;
      }

      // verifyOtp succeeded — recovery session established.
      setRecoveryState("recovering");
      setStage("set_password");
    } catch {
      stopOp();
      setServerError(
        "We couldn't verify that code right now. Please try again."
      );
      setStage("enter_code");
    }
  }, [email, code, startOp, stopOp, setRecoveryState]);

  // ── STEP 3: Update password ──
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
            setServerError(
              "New password must be different from your current password."
            );
          } else {
            setServerError(
              "We couldn't change your password right now. Please try again."
            );
          }
          setStage("set_password");
          return;
        }

        setRecoveryState("none");
        setStage("success");
      } catch {
        stopOp();
        setServerError(
          "We couldn't change your password right now. Please try again."
        );
        setStage("set_password");
      }
    },
    [startOp, stopOp, setRecoveryState]
  );

  // ── Resend code ──
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
      const result = await requestPasswordReset(email, turnstileToken);
      stopOp();

      if (!result.success) {
        setServerError(
          "We couldn't send a new code right now. Please try again."
        );
        return;
      }

      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setCode("");
      toast.success("New code sent");
    } catch {
      stopOp();
      setServerError(
        "We couldn't send a new code right now. Please try again."
      );
    }
  }, [email, resendCooldown, requestTurnstile, startOp, stopOp]);

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════

  // ── Loading states ──
  if (stage === "verifying" || stage === "updating") {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {stage === "verifying"
            ? "Verifying your code..."
            : "Updating your password..."}
        </p>
      </div>
    );
  }

  // ── Success state ──
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
        <Button
          asChild
          className="press w-full bg-foreground text-background hover:bg-foreground/90"
        >
          <Link href="/">Continue to your account</Link>
        </Button>
      </div>
    );
  }

  // ── Set password stage ──
  if (stage === "set_password") {
    return (
      <form
        onSubmit={passwordForm.handleSubmit(handleUpdatePassword)}
        noValidate
        className="mt-6 space-y-4"
        aria-label="Set new password form"
      >
        {serverError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">
          Choose a new password for{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="forgot-new-password">New password</Label>
          <Input
            id="forgot-new-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            placeholder="Min 8 chars, uppercase, number, symbol"
            aria-invalid={!!passwordForm.formState.errors.password}
            aria-describedby={
              passwordForm.formState.errors.password
                ? "forgot-password-error"
                : "forgot-password-hint"
            }
            {...passwordForm.register("password")}
          />
          {!passwordForm.formState.errors.password && (
            <p
              id="forgot-password-hint"
              className="text-xs text-muted-foreground"
            >
              8+ characters with uppercase, a number, and a special character.
            </p>
          )}
          {passwordForm.formState.errors.password && (
            <p
              id="forgot-password-error"
              role="alert"
              className="text-destructive text-sm"
            >
              {passwordForm.formState.errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="forgot-confirm-password">Confirm new password</Label>
          <Input
            id="forgot-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-invalid={!!passwordForm.formState.errors.confirmPassword}
            aria-describedby={
              passwordForm.formState.errors.confirmPassword
                ? "forgot-confirm-error"
                : undefined
            }
            {...passwordForm.register("confirmPassword")}
          />
          {passwordForm.formState.errors.confirmPassword && (
            <p
              id="forgot-confirm-error"
              role="alert"
              className="text-destructive text-sm"
            >
              {passwordForm.formState.errors.confirmPassword.message}
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

  // ── Enter code stage ──
  if (stage === "enter_code") {
    const maskedEmail =
      email.replace(/(.{2})(.*)(@.*)/, "$1***$3") || email;
    return (
      <div className="mt-6 space-y-4" aria-label="Enter recovery code">
        {serverError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{maskedEmail}</span>.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="forgot-code">Recovery code</Label>
          <Input
            id="forgot-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length >= 4) {
                e.preventDefault();
                handleVerifyCode();
              }
            }}
            aria-describedby="forgot-code-hint"
          />
          <p id="forgot-code-hint" className="text-xs text-muted-foreground">
            Check your email for the code. It expires in 10 minutes.
          </p>
        </div>

        <Button
          onClick={handleVerifyCode}
          disabled={code.length < 4}
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
          <button
            type="button"
            onClick={() => {
              setStage("request_email");
              setEmail("");
              setCode("");
              setServerError(null);
            }}
            className="font-medium text-copper hover:underline"
          >
            Try a different email
          </button>
        </div>
      </div>
    );
  }

  // ── Request email stage (default) ──
  return (
    <form
      onSubmit={emailForm.handleSubmit(handleRequestEmail)}
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
          aria-invalid={!!emailForm.formState.errors.email}
          aria-describedby={
            emailForm.formState.errors.email ? "forgot-email-error" : undefined
          }
          {...emailForm.register("email")}
        />
        {emailForm.formState.errors.email && (
          <p
            id="forgot-email-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {emailForm.formState.errors.email.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={emailForm.formState.isSubmitting}
        className="press w-full bg-foreground text-background hover:bg-foreground/90"
      >
        {emailForm.formState.isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Sending code...
          </>
        ) : (
          "Send reset code"
        )}
      </Button>
    </form>
  );
}
