"use client";

import { useState } from "react";
import { Link } from "@/components/shared/Link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { errorTitle } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function SignInForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const remember = useWatch({ control, name: "remember" });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        setServerError(errorTitle("SIGNIN_FAILED"));
        setSubmitting(false);
        return;
      }

      toast.success("Signed in", {
        description: "Welcome back to Fusion Gadgets.",
      });
      router.push("/account");
    } catch {
      setServerError(errorTitle("NETWORK_ERROR"));
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 space-y-4"
      aria-label="Sign in form"
    >
      {serverError && (
        <Alert variant="destructive" id="signin-server-error" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "signin-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p
            id="signin-email-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
          <Link
            href="/auth/forgot-password"
            className="text-xs font-medium text-copper hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="signin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "signin-password-error" : undefined}
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
        {errors.password && (
          <p
            id="signin-password-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="signin-remember"
          checked={remember}
          onCheckedChange={(v) =>
            setValue("remember", v === true, { shouldDirty: true })
          }
        />
        <Label htmlFor="signin-remember" className="text-sm font-normal">
          Remember me on this device
        </Label>
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="press w-full bg-foreground text-background hover:bg-foreground/90"
      >
        {submitting ? (
          <>
            <Loader2 className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
