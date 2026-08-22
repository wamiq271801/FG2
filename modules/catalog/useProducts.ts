"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product, VariationItem } from "@/types";
import { deriveAvailability } from "@/types";

type VariationItemRow = {
  id: string;
  variation_id: string;
  product_id: string;
  option_label: string;
  position: number;
  products: {
    id: string;
    slug: string;
    name: string;
    stock: number;
    is_active: boolean;
    is_preorder: boolean;
    product_images: { url: string; position: number; is_primary: boolean }[];
  }[] | null;
};

type CardRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  subtitle: string;
  subcategory: string | null;
  tagline: string;
  price: number;
  compare_at_price: number | null;
  currency: "INR";
  visual_key: Product["visualKey"];
  accent: string;
  is_preorder: boolean;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  added_at: string;
  brands: { slug: string; name: string } | null;
  categories: { slug: string } | null;
  product_images: { url: string; position: number; is_primary: boolean }[];
  product_variation_items: VariationItemRow[] | null;
};

function mapVariationItem(row: VariationItemRow): VariationItem {
  const product = row.products?.[0] ?? null;
  const images = [...(product?.product_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.url);
  return {
    productId: row.product_id,
    slug: product?.slug ?? "",
    label: row.option_label,
    position: row.position,
    primaryImage: images[0],
    inStock: product ? (product.is_preorder || product.stock > 0) && product.is_active : false,
  };
}

function mapCard(row: CardRow): Product {
  const images = [...(row.product_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.url);
  const variationItems = row.product_variation_items ?? [];
  const variation =
    variationItems.length >= 2
      ? {
          id: variationItems[0].variation_id,
          items: [...variationItems]
            .sort((a, b) => a.position - b.position)
            .map(mapVariationItem),
        }
      : undefined;
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    brand: row.brands?.slug ?? "",
    brandName: row.brands?.name,
    category: row.categories?.slug ?? "",
    subcategory: row.subcategory ?? undefined,
    tagline: row.tagline,
    price: row.price,
    compareAt: row.compare_at_price ?? undefined,
    currency: row.currency,
    images,
    visualKey: row.visual_key,
    accent: row.accent,
    availability: deriveAvailability(row.stock, row.is_preorder, row.is_active),
    stock: row.stock,
    isPreorder: row.is_preorder,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    addedAt: row.added_at,
    variation,
  };
}

const SELECT = `
  id, sku, slug, name, subtitle, subcategory, tagline,
  price, compare_at_price, currency, visual_key, accent,
  is_preorder, stock, is_active,
  rating, review_count, added_at,
  brands!inner(slug, name),
  categories!inner(slug),
  product_images(url, position, is_primary),
  product_variation_items(
    id, variation_id, product_id, option_label, position,
    products!product_variation_items_product_id_fkey(id, slug, name, stock, is_active, is_preorder, product_images(url, position, is_primary))
  )
`;

export function useProductsBySlugs(slugs: string[]): { products: Product[]; loading: boolean } {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slugs.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("products")
      .select(SELECT)
      .in("slug", slugs)
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setProducts([]);
        } else {
          setProducts((data as CardRow[]).map(mapCard));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slugs.join(",")]);

  return { products, loading };
}

export function useProductsByIds(ids: string[]): { products: Product[]; loading: boolean } {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("products")
      .select(SELECT)
      .in("id", ids)
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setProducts([]);
        } else {
          const rows = data as CardRow[];
          const mapped = ids
            .map((id) => rows.find((r) => r.id === id))
            .filter((r): r is CardRow => Boolean(r))
            .map(mapCard);
          setProducts(mapped);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids.join(",")]);

  return { products, loading };
}
