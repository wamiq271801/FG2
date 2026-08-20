"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/modules/cart";
import { useWishlist } from "@/modules/wishlist";
import { useOperation } from "@/hooks/use-operation";

/**
 * Centralized sign-out logic — used by both SignOutButton (Account page)
 * and the header dropdown logout dialog. One implementation, no duplication.
 */
export function useSignOut() {
  const router = useRouter();
  const resetCart = useCart((s) => s.resetForSignOut);
  const resetWishlist = useWishlist((s) => s.resetForSignOut);
  const [signingOut, setSigningOut] = useState(false);
  const { start: startOp, stop: stopOp } = useOperation();

  async function signOut() {
    setSigningOut(true);
    startOp("Logging you out");
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      resetCart();
      resetWishlist();
      router.push("/");
      stopOp();
      toast.success("Signed out");
    } catch {
      stopOp();
      toast.error("Couldn't sign out — please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return { signOut, signingOut };
}
