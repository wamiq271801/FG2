"use client";

import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type RecentActivityItem = {
  id: string;
  label: string;
  detail: string;
  date: string; // ISO
  kind: "signin" | "password" | "address" | "order";
};

type Props = {
  className?: string;
  recentActivity: RecentActivityItem[];
  twoFactorEnabled?: boolean;
};

/**
 * SecurityPanel — small client island that owns the 2FA toggle's mock state
 * and renders the password-change link + recent activity list. The recent
 * activity is passed in as a prop from the server so it stays server-authoritative.
 */
export function SecurityPanel({
  className,
  recentActivity,
  twoFactorEnabled = false,
}: Props) {
  const [twoFA, setTwoFA] = useState(twoFactorEnabled);
  const [toggling, setToggling] = useState(false);

  async function handleToggle(value: boolean) {
    setToggling(true);
    await new Promise((r) => setTimeout(r, 400));
    setTwoFA(value);
    setToggling(false);
    toast.success(value ? "Two-factor enabled" : "Two-factor disabled", {
      description: value
        ? "You'll be asked for a code at sign-in."
        : "Two-factor authentication is now off.",
    });
  }

  return (
    <Card className={cn("border-border/70", className)}>
      <CardHeader>
        <CardTitle className="font-display text-xl tracking-tight">
          Security &amp; account
        </CardTitle>
        <CardDescription>
          Keep your account safe and review recent activity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Password */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/70">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium leading-tight">Password</p>
              <p className="text-xs text-muted-foreground">
                Last updated 3 months ago. We recommend rotating it quarterly.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="press"
            onClick={() =>
              toast.message("Change password", {
                description: "A password reset flow will open here.",
              })
            }
          >
            Change
          </Button>
        </div>

        {/* Two-factor */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3.5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/70">
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </div>
            <div className="space-y-0.5">
              <Label
                htmlFor="security-2fa"
                className="text-sm font-medium leading-tight"
              >
                Two-factor authentication
              </Label>
              <p className="text-xs text-muted-foreground">
                An extra code at sign-in, generated on your phone.
              </p>
            </div>
          </div>
          <Switch
            id="security-2fa"
            checked={twoFA}
            onCheckedChange={handleToggle}
            disabled={toggling}
            aria-label="Two-factor authentication"
          />
        </div>

        {/* Recent activity */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Recent activity
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Last 30 days
            </span>
          </div>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/60">
            {recentActivity.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 px-3.5 py-2.5"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-copper"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
                <time
                  dateTime={item.date}
                  className="shrink-0 font-mono text-[11px] text-muted-foreground"
                >
                  {new Date(item.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
