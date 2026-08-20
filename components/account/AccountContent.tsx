"use client";

import { Link } from "@/components/shared/Link";
import {
  ArrowRight,
  CalendarDays,
  Mail,
  Phone,
  Package,
  MapPin,
  User as UserIcon,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SignOutButton } from "@/components/account/SignOutButton";
import { EditProfileButton } from "@/components/account/EditProfileButton";
import { OnboardingPanel } from "@/components/account/OnboardingPanel";
import { PreferencesPanel } from "@/components/account/PreferencesPanel";
import { useProfile } from "@/modules/account";

export function AccountContent() {
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile();

  if (profileLoading) {
    return (
      <div className="mt-8 space-y-6" aria-busy="true" aria-label="Loading your account">
        <div className="h-24 rounded-xl bg-muted/60 animate-pulse" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 rounded-xl bg-muted/40 animate-pulse" />
          <div className="h-48 rounded-xl bg-muted/40 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const firstName = (profile.full_name ?? "").split(" ")[0] || "there";
  const initials = (profile.full_name ?? "")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (profile.onboarding_state === "incomplete") {
    return (
      <OnboardingPanel
        profile={profile}
        onComplete={refreshProfile}
      />
    );
  }

  return (
    <>
      {/* Page header */}
      <header className="mt-8 flex flex-col gap-4 rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-display text-xl"
          >
            {initials || "—"}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-copper">
              Hello, {firstName}
            </p>
            <h2 className="font-display text-2xl tracking-tight">
              {profile.full_name ?? "Account"}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Member since {formatDate(profile.member_since)}
            </p>
          </div>
        </div>
        <SignOutButton className="press" />
      </header>

      {/* Quick navigation */}
      <nav aria-label="Account shortcuts" className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/orders"
          className="group flex items-center justify-between rounded-xl border border-border/70 bg-card p-4 press hover:border-copper/40"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground/70">
              <Package className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium leading-tight">Orders</p>
              <p className="text-xs text-muted-foreground">Track, return, or buy again</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/addresses"
          className="group flex items-center justify-between rounded-xl border border-border/70 bg-card p-4 press hover:border-copper/40"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground/70">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium leading-tight">Addresses</p>
              <p className="text-xs text-muted-foreground">Manage delivery addresses</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </nav>

      {/* Profile + Preferences */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Card className="border-border/70">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="font-display text-xl tracking-tight">
                Personal information
              </CardTitle>
              <CardDescription>
                Your name and contact details.
              </CardDescription>
            </div>
            <EditProfileButton
              initialName={profile.full_name ?? ""}
              initialEmail={profile.email}
              initialPhone={profile.phone ?? ""}
              onSaved={refreshProfile}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <ProfileRow icon={<UserIcon className="h-4 w-4" />} label="Name" value={profile.full_name ?? "—"} />
            <Separator />
            <ProfileRow icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email} />
            <Separator />
            <ProfileRow icon={<Phone className="h-4 w-4" />} label="Phone" value={profile.phone ?? "—"} />
          </CardContent>
        </Card>

        <PreferencesPanel
          initial={{
            newsletter: profile.pref_newsletter,
            productUpdates: profile.pref_product_updates,
            orderUpdates: profile.pref_order_updates,
          }}
          className="mt-0"
          onSaved={refreshProfile}
        />
      </div>
    </>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/70">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
