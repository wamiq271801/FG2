"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
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
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/modules/cart";
import { useWishlist } from "@/modules/wishlist";
import { useOperation } from "@/hooks/use-operation";
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
  const router = useRouter();
  const resetCart = useCart((s) => s.resetForSignOut);
  const resetWishlist = useWishlist((s) => s.resetForSignOut);
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  const { start: startOp, stop: stopOp } = useOperation();

  async function handleSignOut() {
    setOpen(false);
    setSigningOut(true);
    startOp("Logging you out");
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      resetCart();
      resetWishlist();
      router.push("/");
      stopOp();
      toast.success("Signed out", {
        description: "You've been signed out of your account.",
      });
    } catch {
      stopOp();
      toast.error("Couldn't sign out", {
        description: "Please try again.",
      });
    } finally {
      setSigningOut(false);
    }
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
            onClick={handleSignOut}
            className="press bg-foreground text-background hover:bg-foreground/90"
          >
            Log out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
