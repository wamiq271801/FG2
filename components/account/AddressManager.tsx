"use client";

import { useState } from "react";
import { ArrowLeft, MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/components/shared/Link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useAddresses, createAddress, updateAddress, deleteAddress } from "@/modules/account";
import { useOperation } from "@/hooks/use-operation";
import type { Address } from "@/modules/account";

type View = "list" | "add" | "edit";
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

function toForm(a: Address): FormState {
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

export function AddressManager() {
  const { addresses, loading, refresh } = useAddresses();
  const [view, setView] = useState<View>("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { start: startOp, stop: stopOp } = useOperation();

  const handleAdd = () => {
    setForm(EMPTY);
    setEditId(null);
    setView("add");
  };

  const handleEdit = (addr: Address) => {
    setForm(toForm(addr));
    setEditId(addr.id);
    setView("edit");
  };

  const handleSave = async () => {
    setSaving(true);
    const isEdit = view === "edit" && editId;
    startOp(isEdit ? "Updating address" : "Saving address");
    try {
      const payload = {
        label: form.label,
        line1: form.line1,
        line2: form.line2 || null,
        city: form.city,
        state: form.state,
        postcode: form.postcode,
        country: form.country,
        phone: form.phone,
        is_default: form.isDefault,
      };
      const result = isEdit
        ? await updateAddress(editId!, payload)
        : await createAddress(payload);
      stopOp();
      if (result.error) {
        toast.error("Couldn't save address", { description: result.error });
        return;
      }
      toast.success(isEdit ? "Address updated" : "Address added");
      await refresh();
      setView("list");
    } catch {
      stopOp();
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    startOp("Removing address");
    try {
      const { error } = await deleteAddress(deleteTarget.id);
      stopOp();
      if (error) {
        toast.error("Couldn't remove", { description: error });
        return;
      }
      toast.success("Address removed");
      await refresh();
      setDeleteTarget(null);
    } catch {
      stopOp();
      toast.error("Network error");
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    startOp("Updating address");
    const { error } = await updateAddress(id, { is_default: true });
    stopOp();
    if (error) {
      toast.error("Couldn't update default", { description: error });
      return;
    }
    toast.success("Default address updated");
    refresh();
  };

  if (loading) {
    return (
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  // Add/Edit form view
  if (view === "add" || view === "edit") {
    return (
      <div className="mt-6 max-w-md">
        <button
          type="button"
          onClick={() => setView("list")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <h2 className="font-display text-xl tracking-tight mb-4">
          {view === "edit" ? "Edit address" : "Add address"}
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="addr-label">Address label</Label>
            <Input id="addr-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home, Office…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-line1">Address line</Label>
            <Input id="addr-line1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} placeholder="Flat / House no, Street" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-line2">Area / locality (optional)</Label>
            <Input id="addr-line2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
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
            Set as primary address
          </label>
        </div>
        <div className="mt-6 flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setView("list")}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.line1 || !form.city || !form.state || !form.postcode || !form.phone}
            className="press bg-foreground text-background hover:bg-foreground/90"
          >
            {view === "edit" ? "Save changes" : "Save address"}
          </Button>
        </div>
      </div>
    );
  }

  // List view (also handles empty)
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl tracking-tight">
          {addresses.length > 0
            ? `${addresses.length} ${addresses.length === 1 ? "address" : "addresses"}`
            : "Your addresses"}
        </h2>
        <Button type="button" variant="outline" size="sm" className="press" onClick={handleAdd}>
          <Plus className="h-4 w-4" /> Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.25} />
          <p className="mt-3 text-sm text-muted-foreground">
            You haven&apos;t added an address yet.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {addresses.map((addr) => (
            <li key={addr.id} className="flex flex-col rounded-xl border border-border/70 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground/70">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium">{addr.label}</span>
                  {addr.is_default && (
                    <span className="rounded-full border border-copper/30 bg-copper/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-copper">
                      Primary
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="press h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(addr)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="press h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(addr)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <address className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground not-italic">
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ""}
                <br />
                {addr.city}, {addr.state} {addr.postcode}
                <br />
                {addr.country}
                <br />
                <span className="font-mono text-xs">{addr.phone}</span>
              </address>
              {!addr.is_default && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(addr.id)}
                  className="press mt-3 flex items-center gap-1 text-xs font-medium text-copper hover:underline"
                >
                  <Star className="h-3 w-3" />
                  Set as primary
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-tight">Remove address?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove &ldquo;{deleteTarget?.label}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="press bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
