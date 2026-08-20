"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  label?: string;
};

export function SignOutButton({
  className,
  variant = "outline",
  size = "default",
  label = "Sign out",
}: Props) {
  const [open, setOpen] = useState(false);
  const { signOut, signingOut } = useSignOut();

  async function handleConfirm() {
    setOpen(false);
    await signOut();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn("press", className)}
          aria-label={label}
          disabled={signingOut}
        >
          <LogOut className="h-4 w-4" />
          <span>{label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            Log out?
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to log out of your account?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleConfirm}
            className="press bg-foreground text-background hover:bg-foreground/90"
          >
            Log out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
