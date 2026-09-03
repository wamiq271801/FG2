import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">Fusion Gadgets Admin</h1>
        <p className="mt-1 text-sm text-muted">
          Private management tool — sign in to continue.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
