"use client";

import { useState } from "react";
import { Heart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/modules/wishlist";
import { useAuthContext } from "@/providers/AuthProvider";
import { trackWishlistAdd } from "@/services/tracking";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  /** The actual product UUID. */
  productId: string;
  /** Product name — for display in the toast notification. */
  name: string;
  /** Slug — for display/tracking only, not the identity key. */
  slug: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
};

export function WishlistButton({
  productId,
  name,
  slug,
  className,
  variant = "outline",
  size = "default",
}: Props) {
  const { user } = useAuthContext();
  const toggle     = useWishlist((s) => s.toggle);
  const guestIds   = useWishlist((s) => s.guestIds);
  const remoteIds  = useWishlist((s) => s.remoteIds);
  const ids        = user ? remoteIds : guestIds;
  const [loading, setLoading]  = useState(false);

  const inWishlist = ids.includes(productId);

  async function handleToggle() {
    if (!productId) return;
    setLoading(true);
    try {
      await toggle(productId, user?.id ?? null);
      if (!inWishlist) trackWishlistAdd(slug);
      toast.success(inWishlist ? "Removed from wishlist" : "Added to wishlist", {
        description: name,
      });
    } catch {
      toast.error("Couldn't update wishlist", { description: "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  if (size === "icon") {
    return (
      <Button
        type="button"
        variant={variant}
        size="icon"
        onClick={handleToggle}
        disabled={loading || !productId}
        className={cn("press", className)}
        aria-label={inWishlist ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      >
        <Heart className={cn("h-4 w-4", inWishlist && "fill-copper text-copper")} />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={loading || !productId}
      className={cn("press", className)}
    >
      {inWishlist ? (
        <>
          <Check className="h-4 w-4" /> Saved
        </>
      ) : (
        <>
          <Heart className="h-4 w-4" /> Save
        </>
      )}
    </Button>
  );
}
