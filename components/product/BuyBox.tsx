"use client";

import { useMemo, useState } from "react";
import { Truck, ShieldCheck, RotateCcw, Check, Bell } from "lucide-react";
import { Gallery } from "@/components/product/Gallery";
import { VariantPicker } from "@/components/product/VariantPicker";
import { QuantityStepper } from "@/components/product/QuantityStepper";
import { AddToCart } from "@/components/product/AddToCart";
import { WishlistButton } from "@/components/product/WishlistButton";
import type { Product, ProductVariant } from "@/types";

type Props = {
  product: Product;
  /**
   * Server-rendered header content (brand, name H1, rating, price,
   * description). Lives above the interactive purchase controls.
   */
  header: React.ReactNode;
  /**
   * Server-rendered footer content (trust row, highlights). Lives below
   * the interactive purchase controls.
   */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * BuyBox — the conversion surface of the product page.
 *
 * Owns the shared purchase state (selected variant + quantity) so the
 * Gallery (left column) and VariantPicker / QuantityStepper / AddToCart
 * (right column) stay in sync. The server-rendered static text — product
 * name, rating, price, description, trust row, highlights — is passed in
 * as `header` and `footer` props so it stays server-rendered HTML, not
 * part of this client component's bundle.
 *
 * Handles three availability modes:
 *  • in-stock / low-stock — full purchase UI
 *  • preorder — "Pre-order" CTA label, quantity + add to bag
 *  • out-of-stock — disabled "Sold out" + an email-when-back form (mock)
 */
export function BuyBox({ product, header, footer, className }: Props) {
  const variants = product.variants ?? [];

  // Default to the first in-stock variant so the page lands on something
  // purchasable. If everything is sold out, fall back to the first variant
  // (the AddToCart will disable itself).
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    () => variants.find((v) => v.inStock)?.id ?? variants[0]?.id
  );
  const [quantity, setQuantity] = useState(1);
  const [emailSent, setEmailSent] = useState(false);

  const selectedVariant: ProductVariant | undefined = useMemo(
    () => variants.find((v) => v.id === selectedVariantId),
    [variants, selectedVariantId]
  );

  const isSoldOut = product.availability === "out-of-stock";
  const isPreorder = product.availability === "preorder";
  const variantOutOfStock = selectedVariant ? !selectedVariant.inStock : false;
  const ctaDisabled = isSoldOut || variantOutOfStock;

  function handleNotify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Mock: in a real backend this would POST to /api/back-in-stock.
    setEmailSent(true);
  }

  return (
    <div className={className}>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Left — Gallery */}
        <Gallery
          visualKey={product.visualKey}
          baseAccent={product.accent}
          variants={variants}
          selectedVariantId={selectedVariantId}
          onSelectVariant={setSelectedVariantId}
          productName={product.name}
          images={product.images}
        />

        {/* Right — purchase panel */}
        <div className="flex flex-col">
          {/* Server-rendered header (brand, H1, rating, price, description) */}
          <div>{header}</div>

          {/* Variant picker */}
          {variants.length > 0 && (
            <VariantPicker
              variants={variants}
              selectedVariantId={selectedVariantId}
              onSelectVariant={setSelectedVariantId}
              className="mt-6"
            />
          )}

          {/* Purchase controls */}
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
              {emailSent ? (
                <p
                  className="mt-3 flex items-center gap-2 rounded-md bg-copper/10 px-3 py-2 text-xs font-medium text-copper"
                  role="status"
                >
                  <Check className="h-3.5 w-3.5" /> Got it — we&#39;ll email you when
                  it&#39;s back.
                </p>
              ) : (
                <form
                  onSubmit={handleNotify}
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                >
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
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                label="Quantity"
              />
              <AddToCart
                product={product}
                variant={selectedVariant}
                quantity={quantity}
                label={isPreorder ? "Pre-order" : "Add to bag"}
                disabled={ctaDisabled}
                className="h-9 min-w-[12rem] flex-1"
              />
              <WishlistButton
                slug={product.slug}
                name={product.name}
                variant="outline"
                size="default"
                className="h-9"
              />
            </div>
          )}

          {/* Trust row */}
          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-border pt-6">
            <TrustItem
              icon={<Truck className="h-4 w-4" />}
              title="Free shipping"
              sub="Across India"
            />
            <TrustItem
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Warranty"
              sub="Up to 5 yrs"
            />
            <TrustItem
              icon={<RotateCcw className="h-4 w-4" />}
              title="7-day returns"
              sub="No questions"
            />
          </div>

          {/* Server-rendered footer (highlights, etc.) */}
          {footer && <div className="mt-7">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
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
