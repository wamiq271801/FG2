"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/modules/cart";
import { useAuthContext } from "@/providers/AuthProvider";
import { trackAddToCart } from "@/services/tracking";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product, ProductVariant } from "@/types";

type Props = {
  product: Product;
  variant?: ProductVariant;
  quantity?: number;
  className?: string;
  label?: string;
  disabled?: boolean;
};

export function AddToCart({
  product,
  variant,
  quantity = 1,
  className,
  label = "Add to bag",
  disabled,
}: Props) {
  const add = useCart((s) => s.add);
  const { user } = useAuthContext();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  const isUnavailable =
    disabled ||
    product.availability === "out-of-stock" ||
    (variant && !variant.inStock);

  async function handleAdd() {
    if (isUnavailable) return;
    setLoading(true);
    try {
      await add(
        {
          slug: product.slug,
          variant: variant?.name ?? "",
          quantity,
        },
        user?.id ?? null
      );
      trackAddToCart(product.slug, quantity);
      setAdded(true);
      toast.success("Added to bag", {
        description: `${product.name}${variant ? ` · ${variant.name}` : ""}`,
        action: { label: "View bag", onClick: () => router.push("/cart") },
      });
      window.setTimeout(() => setAdded(false), 1600);
    } catch {
      toast.error("Couldn't add to bag", {
        description: "Please try again.",
      });
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
      {added ? (
        <>
          <Check className="h-4 w-4" /> Added
        </>
      ) : (
        <>
          <ShoppingBag className="h-4 w-4" /> {label}
        </>
      )}
    </Button>
  );
}
