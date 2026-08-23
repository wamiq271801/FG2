"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, useProductInCart } from "@/modules/cart";
import { useAuthContext } from "@/providers/AuthProvider";
import { trackAddToCart } from "@/services/tracking";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

type Props = {
  product: Product;
  /** The actual product UUID to add to the cart. */
  productId: string;
  quantity?: number;
  className?: string;
  label?: string;
  disabled?: boolean;
};

export function AddToCart({
  product,
  productId,
  quantity = 1,
  className,
  disabled,
}: Props) {
  const add = useCart((s) => s.add);
  const { user } = useAuthContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const inCart = useProductInCart(productId);

  const isUnavailable = disabled || !productId;

  async function handleAdd() {
    if (isUnavailable || inCart) {
      // Already in cart — navigate to cart
      router.push("/cart");
      return;
    }
    setLoading(true);
    try {
      const result = await add({ productId, quantity }, user?.id ?? null);
      if (result === "added") {
        trackAddToCart(product.slug, quantity);
        toast.success("Added to bag", {
          description: product.name,
          action: { label: "View bag", onClick: () => router.push("/cart") },
        });
      }
      // If "already_in_cart", button already shows "View cart" — no toast needed
    } catch {
      toast.error("Couldn't add to bag", { description: "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleAdd}
      disabled={isUnavailable || loading}
      className={cn("press", className)}
    >
      {inCart ? (
        <>
          <ArrowRight className="h-4 w-4" /> View cart
        </>
      ) : (
        <>
          <ShoppingBag className="h-4 w-4" /> {isUnavailable ? "Unavailable" : "Add to bag"}
        </>
      )}
    </Button>
  );
}
