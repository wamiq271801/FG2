"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateProfile } from "@/modules/account";

type Props = {
  initialName: string;
  initialEmail: string;
  initialPhone?: string;
  onSaved?: () => void;
};

export function EditProfileButton({
  initialName,
  initialEmail,
  initialPhone,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: initialName,
    phone: initialPhone ?? "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ name: initialName, phone: initialPhone ?? "" });
    }
  }, [open, initialName, initialPhone]);

  async function handleSave() {
    setSaving(true);
    const { error } = await updateProfile({
      full_name: form.name,
      phone: form.phone,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save", { description: error });
      return;
    }
    setOpen(false);
    toast.success("Profile updated", {
      description: "Your personal information has been saved.",
    });
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="press">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            Edit profile
          </DialogTitle>
          <DialogDescription>
            Update your name and phone. Email cannot be changed here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email address</Label>
            <Input
              id="profile-email"
              type="email"
              value={initialEmail}
              disabled
              className="bg-muted/50 text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              autoComplete="tel"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={saving}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="press bg-foreground text-background hover:bg-foreground/90"
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
