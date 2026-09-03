"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, null);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state?.error && <FormMessage kind="error">{state.error}</FormMessage>}
      <Field label="Admin password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
