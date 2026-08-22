"use client";

import { useState } from "react";
import { Bell, Check, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { QuantityStepper } from "./QuantityStepper";
import { AddToCart } from "./AddToCart";
import type { Product, Promotion } from "@/types";

type Props = {
  product: Product;
  offers?: Promotion[];
};

export function PurchaseControls({ product, offers = [] }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [notify, setNotify] = useState({ sent: false });

  const isSoldOut = product.availability === "out-of-stock";
  const isPreorder = product.availability === "preorder";

  function handleNotify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotify({ sent: true });
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        {offers.map((promo) => (
          <a
            key={promo.slug}
            href="/offers"
            className="inline-flex items-center gap-1.5 rounded-full bg-copper/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-copper hover:bg-copper/20"
          >
            {promo.badge || promo.title}
          </a>
        ))}
      </div>

      {isSoldOut ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-copper" />
            <p className="text-sm font-medium">Back in stock soon</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            We&#39;re expecting more. Leave your email and we&#39;ll let you
            know the moment they arrive.
          </p>
          {notify.sent ? (
            <p
              className="mt-3 flex items-center gap-2 rounded-md bg-copper/10 px-3 py-2 text-xs font-medium text-copper"
              role="status"
            >
              <Check className="h-3.5 w-3.5" /> Got it — we&#39;ll email you when
              it&#39;s back.
            </p>
          ) : (
            <form onSubmit={handleNotify} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label htmlFor="notify-email" className="sr-only">
                Email address
              </label>
              <input
                id="notify-email"
                type="email"
                required
                placeholder="you@example.com"
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-copper/40"
              />
              <button
                type="submit"
                className="press inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
              >
                Notify me
              </button>
            </form>
          )}
          <button
            type="button"
            disabled
            className="press mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-muted text-sm font-medium text-muted-foreground"
          >
            Sold out
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} label="Quantity" />
          <AddToCart
            product={product}
            productId={product.id}
            quantity={quantity}
            label={isPreorder ? "Pre-order" : "Add to bag"}
            className="h-9 min-w-[12rem] flex-1"
          />
        </div>
      )}

      <div className="mt-7 grid grid-cols-3 gap-3 border-t border-border pt-6">
        <TrustItem icon={<Truck className="h-4 w-4" />} title="Free shipping" sub="Across India" />
        <TrustItem icon={<ShieldCheck className="h-4 w-4" />} title="Warranty" sub="Up to 5 yrs" />
        <TrustItem icon={<RotateCcw className="h-4 w-4" />} title="7-day returns" sub="No questions" />
      </div>
    </>
  );
}

function TrustItem({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-copper">{icon}</span>
      <div>
        <p className="text-xs font-medium leading-tight text-foreground">{title}</p>
        <p className="text-[11px] leading-tight text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}
