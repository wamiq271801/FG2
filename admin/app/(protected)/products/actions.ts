"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasAdminSession } from "@/lib/auth";
import { notifyStorefront } from "@/lib/notify";
import { withNotifyFailed, type StorefrontEvent } from "@/lib/notify-types";
import {
  VISUAL_KEYS,
  addProductImage,
  createProduct,
  deleteProduct,
  deleteProductImage,
  getProduct,
  setPrimaryImage,
  setProductActive,
  updateProduct,
  type ProductInput,
} from "@/lib/data/products";
import { logout } from "@/lib/auth";

/**
 * Product mutations + storefront cache-invalidation notifications.
 *
 * Flow (docs/phase-2-architecture.md): the DB mutation runs first; ONLY
 * after it succeeds does exactly one notifyStorefront(event) attempt go
 * out. A failed notification never rolls back the mutation — both facts
 * are surfaced (dbSuccess + notify) so the operator can retry the
 * notification explicitly. No admin-local revalidation exists (it never
 * affected the storefront's cache).
 */

export type ProductFormState =
  | { error: string } // validation/DB failure
  | { success: string } // DB ok + notification ok
  | {
      dbSuccess: string; // DB ok, notification failed
      notify: { failed: true; message: string };
      event: StorefrontEvent;
      retryRedirectTo?: string;
    }
  | null;

/** Every privileged action re-verifies the session (actions are endpoints). */
async function requireSession() {
  if (!(await hasAdminSession())) {
    await logout();
    redirect("/login");
  }
}

const productSchema = z.object({
  slug: z.string().min(1, "Slug is required."),
  name: z.string().min(1, "Name is required."),
  subtitle: z.string().min(1, "Subtitle is required."),
  brand_id: z.string().uuid("Pick a brand."),
  category_id: z.string().uuid("Pick a category."),
  subcategory: z.string().trim().optional(),
  tagline: z.string().min(1, "Tagline is required."),
  description: z.string().min(1, "Description is required."),
  story: z.string().optional().default(""),
  price: z.coerce.number().int("Price must be a whole number.").min(0, "Price must be ≥ 0."),
  compare_at_price: z
    .union([z.coerce.number().int().positive("Compare-at must be > price."), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .optional(),
  visual_key: z.enum(VISUAL_KEYS, "Pick a visual type."),
  accent: z.string().min(1, "Accent is required."),
  stock: z.coerce.number().int("Stock must be a whole number.").min(0, "Stock must be ≥ 0."),
  is_active: z.boolean().default(true),
  is_preorder: z.boolean().default(false),
  shipping: z.string().optional().default(""),
  warranty: z.string().optional().default(""),
  highlights: z.array(z.string()).default([]),
  includes: z.array(z.string()).default([]),
  specs: z
    .array(z.object({ key: z.string().min(1), value: z.string() }))
    .default([]),
  sku: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{0,10}$/i, "SKU must be 1–10 letters/digits (or blank to auto-generate).")
    .optional(),
});

function parseLines(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseSpecs(raw: FormDataEntryValue | null): { key: string; value: string }[] {
  return parseLines(raw).map((line) => {
    const idx = line.indexOf(":");
    if (idx > 0) {
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    }
    return { key: line, value: "" };
  });
}

function parseProductForm(formData: FormData): ProductInput | { error: string } {
  const parsed = productSchema.safeParse({
    slug: String(formData.get("slug") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    subtitle: String(formData.get("subtitle") ?? "").trim(),
    brand_id: String(formData.get("brand_id") ?? ""),
    category_id: String(formData.get("category_id") ?? ""),
    subcategory: String(formData.get("subcategory") ?? "").trim() || undefined,
    tagline: String(formData.get("tagline") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    story: String(formData.get("story") ?? ""),
    price: String(formData.get("price") ?? "0"),
    compare_at_price: String(formData.get("compare_at_price") ?? "").trim() || "",
    visual_key: String(formData.get("visual_key") ?? ""),
    accent: String(formData.get("accent") ?? "").trim(),
    stock: String(formData.get("stock") ?? "0"),
    is_active: formData.get("is_active") === "on",
    is_preorder: formData.get("is_preorder") === "on",
    shipping: String(formData.get("shipping") ?? ""),
    warranty: String(formData.get("warranty") ?? ""),
    highlights: parseLines(formData.get("highlights")),
    includes: parseLines(formData.get("includes")),
    specs: parseSpecs(formData.get("specs")),
    sku: String(formData.get("sku") ?? "").trim().toUpperCase() || undefined,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first ? `${first.message}` : "Invalid product data." };
  }
  const value = parsed.data;
  return {
    slug: value.slug,
    name: value.name,
    subtitle: value.subtitle,
    brand_id: value.brand_id,
    category_id: value.category_id,
    subcategory: value.subcategory || null,
    tagline: value.tagline,
    description: value.description,
    story: value.story ?? "",
    price: value.price,
    compare_at_price: value.compare_at_price ?? null,
    visual_key: value.visual_key,
    accent: value.accent,
    stock: value.stock,
    is_active: value.is_active,
    is_preorder: value.is_preorder,
    highlights: value.highlights,
    includes: value.includes,
    specs: value.specs,
    shipping: value.shipping ?? "",
    warranty: value.warranty ?? "",
    sku: value.sku,
  };
}

function friendlyDbError(error: unknown): string {
  const err = error as { message?: string; code?: string; details?: string } | null;
  const message =
    (err && typeof err.message === "string" && err.message) ||
    (error instanceof Error && error.message) ||
    (typeof error === "string" && error) ||
    JSON.stringify(error)?.slice(0, 300) ||
    "unknown error";
  if (/duplicate key|unique/i.test(message)) {
    return "A row with this slug (or SKU) already exists.";
  }
  if (/violates foreign key/i.test(message)) {
    return "This change violates an existing relationship (e.g. the brand or category no longer exists).";
  }
  if (/check constraint/i.test(message)) {
    return "A value failed its database constraint (price, stock, rating range or SKU format).";
  }
  return `Database error: ${message}`;
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireSession();
  const input = parseProductForm(formData);
  if ("error" in input) return { error: input.error };
  let newId: string;
  try {
    newId = await createProduct(input);
  } catch (error) {
    return { error: friendlyDbError(error) };
  }

  const event: StorefrontEvent = { type: "product.created", productId: newId };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    // DB row exists; the storefront is stale. No redirect — the form
    // shows the failure and offers the explicit retry.
    return {
      dbSuccess: "Product created.",
      notify: { failed: true, message: notify.message },
      event,
      retryRedirectTo: `/products/${newId}?created=1`,
    };
  }
  // redirect() throws a control-flow error — it must stay OUTSIDE the
  // try/catch or the catch would swallow it.
  redirect(`/products/${newId}?created=1`);
}

export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing product id." };
  const input = parseProductForm(formData);
  if ("error" in input) return { error: input.error };

  // The event carries the PREVIOUS slug / category when they changed, so
  // the old row must be read BEFORE the mutation.
  let old: { slug: string; category_id: string } | null = null;
  try {
    const current = await getProduct(id);
    if (current) {
      old = { slug: current.product.slug, category_id: current.product.category_id };
    }
  } catch (error) {
    return { error: friendlyDbError(error) };
  }

  try {
    await updateProduct(id, input);
  } catch (error) {
    return { error: friendlyDbError(error) };
  }

  const event: StorefrontEvent = {
    type: "product.updated",
    productId: id,
    ...(old && old.slug !== input.slug ? { previousSlug: old.slug } : {}),
    ...(old && old.category_id !== input.category_id
      ? { previousCategoryId: old.category_id }
      : {}),
  };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    return {
      dbSuccess: "Product saved.",
      notify: { failed: true, message: notify.message },
      event,
    };
  }
  return { success: "Product saved. Storefront revalidated." };
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await setProductActive(id, false);
  } catch {
    // Surface via the page's error banner on redirect.
    redirect(`/products/${id}?error=archive-failed`);
  }
  const event: StorefrontEvent = { type: "product.updated", productId: id };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    redirect(withNotifyFailed(`/products/${id}`, event, notify.message));
  }
  redirect(`/products/${id}`);
}

export async function activateProductAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await setProductActive(id, true);
  } catch {
    redirect(`/products/${id}?error=activate-failed`);
  }
  const event: StorefrontEvent = { type: "product.updated", productId: id };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    redirect(withNotifyFailed(`/products/${id}`, event, notify.message));
  }
  redirect(`/products/${id}`);
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Capture the row BEFORE deleting — the event needs its slug + category.
  let old: { slug: string; category_id: string } | null = null;
  try {
    const current = await getProduct(id);
    if (current) {
      old = { slug: current.product.slug, category_id: current.product.category_id };
    }
  } catch {
    redirect(`/products/${id}?error=delete-failed`);
  }
  try {
    await deleteProduct(id);
  } catch (error) {
    const message = /foreign key|violates/i.test(String(error))
      ? "This product is referenced by order history and cannot be deleted — archive it instead."
      : "delete-failed";
    redirect(`/products/${id}?error=${encodeURIComponent(message)}`);
  }
  const event: StorefrontEvent = {
    type: "product.deleted",
    productId: id,
    ...(old ? { slug: old.slug, previousCategoryId: old.category_id } : {}),
  };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    // The list page renders the retry banner for the deleted row.
    redirect(withNotifyFailed("/products?deleted=1", event, notify.message));
  }
  redirect("/products?deleted=1");
}

// ── Image management ──────────────────────────────────────────────────
// Images are part of the product's cached public representation, so every
// image mutation notifies product.updated.

export async function addImageAction(formData: FormData): Promise<void> {
  await requireSession();
  const productId = String(formData.get("product_id") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  if (!productId) return;
  if (!/^https?:\/\//i.test(url)) {
    redirect(`/products/${productId}?error=${encodeURIComponent("Image URL must start with http(s)://")}`);
  }
  try {
    await addProductImage(productId, url);
  } catch (error) {
    redirect(
      `/products/${productId}?error=${encodeURIComponent(friendlyDbError(error))}`
    );
  }
  const event: StorefrontEvent = { type: "product.updated", productId };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    redirect(withNotifyFailed(`/products/${productId}`, event, notify.message));
  }
  redirect(`/products/${productId}`);
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  await requireSession();
  const productId = String(formData.get("product_id") ?? "");
  const imageId = String(formData.get("image_id") ?? "");
  if (!productId || !imageId) return;
  try {
    await deleteProductImage(imageId);
  } catch (error) {
    redirect(
      `/products/${productId}?error=${encodeURIComponent(friendlyDbError(error))}`
    );
  }
  const event: StorefrontEvent = { type: "product.updated", productId };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    redirect(withNotifyFailed(`/products/${productId}`, event, notify.message));
  }
  redirect(`/products/${productId}`);
}

export async function setPrimaryImageAction(formData: FormData): Promise<void> {
  await requireSession();
  const productId = String(formData.get("product_id") ?? "");
  const imageId = String(formData.get("image_id") ?? "");
  if (!productId || !imageId) return;
  try {
    await setPrimaryImage(productId, imageId);
  } catch (error) {
    redirect(
      `/products/${productId}?error=${encodeURIComponent(friendlyDbError(error))}`
    );
  }
  const event: StorefrontEvent = { type: "product.updated", productId };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    redirect(withNotifyFailed(`/products/${productId}`, event, notify.message));
  }
  redirect(`/products/${productId}`);
}

// ── Manual storefront refresh (operator-triggered) ────────────────────

/**
 * "Revalidate storefront" button on the product page — sends a
 * product.refresh event through the exact same notification path as the
 * automatic mutations (one system, no special cases).
 */
export async function refreshProductAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("product_id") ?? "");
  if (!id) return;
  const event: StorefrontEvent = { type: "product.refresh", productId: id };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    redirect(withNotifyFailed(`/products/${id}`, event, notify.message));
  }
  redirect(`/products/${id}?refreshed=1`);
}
