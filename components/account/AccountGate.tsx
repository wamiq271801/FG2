"use client";

import { Link } from "@/components/shared/Link";
import { LockKeyhole } from "lucide-react";
import { useAuthContext } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * AccountGate — small client island that decides whether to render the
 * authenticated account surface or a "please sign in" prompt.
 *
 * The surrounding page shell (H1, intro, container) is server-rendered and
 * always visible. This component only gates the authed-only content that gets
 * passed in as `children` (which itself stays server-rendered, since Next.js
 * supports passing server-rendered subtrees into client components as props).
 */
export function AccountGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuthContext();

  if (!ready) {
    // Hydrating — render subtle skeletons so the page doesn't flash the
    // sign-in prompt while the auth store rehydrates from localStorage.
    return (
      <div
        className="space-y-6"
        aria-busy="true"
        aria-label="Loading your account"
      >
        <div className="h-24 rounded-xl bg-muted/60 animate-pulse" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 rounded-xl bg-muted/40 animate-pulse" />
          <div className="h-48 rounded-xl bg-muted/40 animate-pulse" />
        </div>
        <div className="h-56 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="mx-auto max-w-md border-copper/25 bg-copper/[0.03]">
        <CardHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-copper/10 text-copper">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <CardTitle className="mt-3 font-display text-2xl tracking-tight">
            Please sign in
          </CardTitle>
          <CardDescription className="text-pretty">
            Sign in to your Fusion Gadgets account to view your profile, saved
            addresses, recent orders, and communication preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              asChild
              className="press bg-foreground text-background hover:bg-foreground/90"
            >
              <Link href="/auth/signin">Sign in</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/auth/signup">Create an account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
