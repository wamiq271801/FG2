"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck, ShieldCheck, RotateCcw, Check, Bell } from "lucide-react";
import { Gallery } from "@/components/product/Gallery";
import { VariationSelector } from "@/components/product/VariationSelector";
import { QuantityStepper } from "@/components/product/QuantityStepper";
import { AddToCart } from "@/components/product/AddToCart";
import { WishlistButton } from "@/components/product/WishlistButton";
import type { Product } from "@/types";

type Props = {
  product: Product;
  /** All products in the same variation (loaded via SSR). */
  allVariationProducts: Product[];
  /**
   * Server-rendered header content (brand, name H1, rating, price, description).
   */
  header: React.ReactNode;
  /**
   * Server-rendered footer content (trust row, highlights).
   */
  footer?: React.ReactNode;
  className?: string;
};

export function BuyBox({
  product,
  allVariationProducts,
  header,
  footer,
  className,
}: Props) {
  const variationItems = product.variation?.items ?? [];

  const [selectedProductId, setSelectedProductId] = useState<string>(product.id);
  const [quantity, setQuantity] = useState(1);
  const [emailSent, setEmailSent] = useState(false);

  const currentProduct = useMemo(() => {
    if (allVariationProducts.length <= 1) return product;
    return allVariationProducts.find((p) => p.id === selectedProductId) ?? product;
  }, [allVariationProducts, selectedProductId, product]);

  useEffect(() => {
    if (selectedProductId === product.id) return;
    const url = `/product/${currentProduct.slug}`;
    window.history.pushState({ productId: selectedProductId }, "", url);
  }, [selectedProductId, product.id, currentProduct.slug]);

  useEffect(() => {
    function handlePopState() {
      const pathParts = window.location.pathname.split("/");
      const slug = pathParts[pathParts.length - 1];
      const match = allVariationProducts.find((p) => p.slug === slug);
      if (match) {
        setSelectedProductId(match.id);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allVariationProducts]);

  const handleOptionSelect = (productId: string) => {
    setSelectedProductId(productId);
  };

  const cartProductId = currentProduct.id;
  const isSoldOut = currentProduct.availability === "out-of-stock";
  const isPreorder = currentProduct.availability === "preorder";
  const ctaDisabled = isSoldOut || !cartProductId;

  function handleNotify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailSent(true);
  }

  return (
    <div className={className}>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Left — Gallery */}
        <Gallery
          product={currentProduct}
          variationProducts={variationItems.length > 1 ? allVariationProducts : []}
          selectedProductId={selectedProductId}
          onSelectProduct={handleOptionSelect}
        />

        {/* Right — purchase panel */}
        <div className="flex flex-col">
          <div>{header}</div>

          {variationItems.length > 1 && (
            <VariationSelector
              variationItems={variationItems}
              selectedProductId={selectedProductId}
              onSelectItem={handleOptionSelect}
              className="mt-6"
            />
          )}

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
                product={currentProduct}
                productId={cartProductId}
                quantity={quantity}
                label={isPreorder ? "Pre-order" : "Add to bag"}
                disabled={ctaDisabled}
                className="h-9 min-w-[12rem] flex-1"
              />
              <WishlistButton
                productId={cartProductId}
                slug={currentProduct.slug}
                name={currentProduct.name}
                variant="outline"
                size="default"
                className="h-9"
              />
            </div>
          )}

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
