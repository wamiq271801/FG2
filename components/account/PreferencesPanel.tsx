"use client";

import { useState } from "react";
import { Bell, Mail, Package, Save } from "lucide-react";
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
import type { User } from "@/types";
import { updateProfile } from "@/modules/account";

type Props = {
  initial: User["preferences"];
  className?: string;
  onSaved?: () => void;
};

const FIELDS = [
  { key: "newsletter" as const, label: "Newsletter", description: "Monthly drops, editorials, and offers — straight to your inbox.", icon: Mail },
  { key: "productUpdates" as const, label: "Product updates", description: "Restocks, new arrivals, and price drops on items you follow.", icon: Bell },
  { key: "orderUpdates" as const, label: "Order updates", description: "Real-time alerts on shipment status and delivery windows.", icon: Package },
];

export function PreferencesPanel({ initial, className, onSaved }: Props) {
  const [prefs, setPrefs] = useState<User["preferences"]>(initial);
  const [saving, setSaving] = useState(false);

  function toggle(key: keyof User["preferences"], value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await updateProfile({
      pref_newsletter: prefs.newsletter,
      pref_product_updates: prefs.productUpdates,
      pref_order_updates: prefs.orderUpdates,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save preferences", { description: error });
      return;
    }
    toast.success("Preferences saved", { description: "We'll update the emails you receive accordingly." });
    onSaved?.();
  }

  return (
    <Card className={cn("border-border/70", className)}>
      <CardHeader>
        <CardTitle className="font-display text-xl tracking-tight">Preferences</CardTitle>
        <CardDescription>Choose which emails you&apos;d like to receive from us.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {FIELDS.map(({ key, label, description, icon: Icon }) => (
          <div key={key} className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3.5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/70">
                <Icon className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor={`pref-${key}`} className="text-sm font-medium leading-tight">{label}</Label>
                <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch id={`pref-${key}`} checked={prefs[key]} onCheckedChange={(v) => toggle(key, v === true)} aria-label={label} />
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <Button type="button" onClick={handleSave} disabled={saving} className="press bg-foreground text-background hover:bg-foreground/90">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
