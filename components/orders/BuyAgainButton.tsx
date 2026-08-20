"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/modules/cart";
import { useAuthContext } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import type { OrderItem } from "@/types";

type Props = {
  items: OrderItem[];
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
};

export function BuyAgainButton({
  items,
  className,
  variant = "outline",
  size = "default",
  label = "Buy again",
}: Props) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const { user } = useAuthContext();
  const [adding, setAdding] = useState(false);

  async function handleBuyAgain() {
    setAdding(true);
    try {
      for (const item of items) {
        await add(
          { slug: item.slug, variant: item.variant ?? "", quantity: item.quantity },
          user?.id ?? null
        );
      }
      const count = items.reduce((n, i) => n + i.quantity, 0);
      toast.success("Added to bag", {
        description: `${count} item${count > 1 ? "s" : ""} from your previous order.`,
        action: { label: "View bag", onClick: () => router.push("/cart") },
      });
      router.push("/cart");
    } catch {
      toast.error("Couldn't add items", { description: "Please try again." });
    } finally {
      setAdding(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleBuyAgain}
      disabled={adding || items.length === 0}
      className={cn("press", className)}
      aria-label={label}
    >
      {adding ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {adding ? "Adding…" : label}
      {!adding && (
        <ShoppingBag className="h-4 w-4 opacity-60" aria-hidden="true" />
      )}
    </Button>
  );
}
