/**
 * Client-safe product constants and form-input types (NO server-only
 * imports) — shared by the Server Components/data layer and the client
 * ProductForm. Anything touching the privileged Supabase client lives in
 * lib/data/* (server-only) instead.
 */

export const VISUAL_KEYS = [
  "headphones",
  "earbuds",
  "speaker",
  "keyboard",
  "mouse",
  "watch",
  "camera",
  "lens",
  "drone",
  "charger",
  "cable",
  "stand",
  "lamp",
  "backpack",
  "controller",
  "mic",
  "monitor",
  "tracker",
] as const;

export type VisualKey = (typeof VISUAL_KEYS)[number];

export type Option = { id: string; name: string };

/** Fields the product form writes (schema-required + managed optional). */
export type ProductInput = {
  slug: string;
  name: string;
  subtitle: string;
  brand_id: string;
  category_id: string;
  subcategory: string | null;
  tagline: string;
  description: string;
  story: string;
  price: number;
  compare_at_price: number | null;
  visual_key: string;
  accent: string;
  stock: number;
  is_active: boolean;
  is_preorder: boolean;
  highlights: string[];
  includes: string[];
  specs: { key: string; value: string }[];
  shipping: string;
  warranty: string;
  sku?: string;
};
