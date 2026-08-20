"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createAddress, updateAddress, deleteAddress } from "@/modules/account";
import type { Address } from "@/modules/account";

type FormState = {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  isDefault: boolean;
};

const EMPTY: FormState = {
  label: "Home",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postcode: "",
  country: "India",
  phone: "",
  isDefault: false,
};

function addressToForm(a: Address): FormState {
  return {
    label: a.label,
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    state: a.state,
    postcode: a.postcode,
    country: a.country,
    phone: a.phone,
    isDefault: a.is_default,
  };
}

function AddressFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="space-y-4 py-1">
      <div className="space-y-1.5">
        <Label htmlFor="addr-label">Label</Label>
        <Input id="addr-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home, Office…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-line1">Address line 1</Label>
        <Input id="addr-line1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} placeholder="Flat / House no, Street" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-line2">Address line 2 (optional)</Label>
        <Input id="addr-line2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} placeholder="Area, Landmark" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="addr-city">City</Label>
          <Input id="addr-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addr-state">State</Label>
          <Input id="addr-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="addr-postcode">PIN code</Label>
          <Input id="addr-postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} inputMode="numeric" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addr-country">Country</Label>
          <Input id="addr-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="addr-phone">Phone</Label>
        <Input id="addr-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
        Set as default address
      </label>
    </div>
  );
}

export function AddAddressButton({ onSaved, className }: { onSaved?: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(EMPTY);
    }
  }, [open]);

  async function handleSave() {
    setSaving(true);
    const { error } = await createAddress({
      label: form.label,
      line1: form.line1,
      line2: form.line2 || null,
      city: form.city,
      state: form.state,
      postcode: form.postcode,
      country: form.country,
      phone: form.phone,
      is_default: form.isDefault,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save address", { description: error });
      return;
    }
    setOpen(false);
    toast.success("Address added");
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className={cn("press", className)}>
          <MapPin className="h-4 w-4" />
          Add address
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">Add address</DialogTitle>
          <DialogDescription>Save a shipping address for faster checkout.</DialogDescription>
        </DialogHeader>
        <AddressFields form={form} setForm={setForm} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={saving}>Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving || !form.line1 || !form.city || !form.state || !form.postcode || !form.phone} className="press bg-foreground text-background hover:bg-foreground/90">
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save address"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AddressActionsProps = {
  addressId: string;
  label: string;
  isDefault?: boolean;
  onSaved?: () => void;
  className?: string;
};

export function AddressActions({ addressId, label, isDefault, onSaved, className }: AddressActionsProps) {
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function handleSetDefault() {
    setBusy(true);
    const { error } = await updateAddress(addressId, { is_default: true });
    setBusy(false);
    if (error) {
      toast.error("Couldn't update default", { description: error });
      return;
    }
    toast.success("Default address updated", { description: `"${label}" is now your default.` });
    onSaved?.();
  }

  async function handleRemove() {
    setBusy(true);
    const { error } = await deleteAddress(addressId);
    setBusy(false);
    if (error) {
      toast.error("Couldn't remove", { description: error });
      return;
    }
    toast.success("Address removed");
    onSaved?.();
  }

  async function handleEditSave() {
    setSaving(true);
    const { error } = await updateAddress(addressId, {
      label: form.label,
      line1: form.line1,
      line2: form.line2 || null,
      city: form.city,
      state: form.state,
      postcode: form.postcode,
      country: form.country,
      phone: form.phone,
      is_default: form.isDefault,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save", { description: error });
      return;
    }
    setEditOpen(false);
    toast.success("Address updated");
    onSaved?.();
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="press h-8 px-2 text-muted-foreground hover:text-foreground" disabled={busy} onClick={() => setForm(EMPTY)}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
            <span className="sr-only">Edit {label} address</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-tight">Edit address</DialogTitle>
            <DialogDescription>Update your saved address.</DialogDescription>
          </DialogHeader>
          <AddressFields form={form} setForm={setForm} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={saving}>Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleEditSave} disabled={saving} className="press bg-foreground text-background hover:bg-foreground/90">
              {saving ? <Loader2 className="animate-spin" /> : null}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="press h-8 w-8 text-muted-foreground hover:text-foreground" aria-label={`More actions for ${label} address`} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreVertical className="h-3.5 w-3.5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit address
          </DropdownMenuItem>
          {!isDefault && (
            <DropdownMenuItem onClick={handleSetDefault}>
              <Star className="h-3.5 w-3.5" /> Set as default
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleRemove} className="text-destructive focus:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
