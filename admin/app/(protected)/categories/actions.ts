"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasAdminSession, logout } from "@/lib/auth";
import { notifyStorefront } from "@/lib/notify";
import { withNotifyFailed, type StorefrontEvent } from "@/lib/notify-types";
import {
  createCategory,
  deleteCategory,
  getCategory,
  updateCategory,
  type CategoryInput,
} from "@/lib/data/categories";

/**
 * Category mutations + storefront cache-invalidation notifications.
 * Same flow as products: DB mutation first, then exactly ONE
 * notifyStorefront(event) attempt; failures never roll back and surface
 * a dbSuccess + notify state with an explicit operator retry.
 */

export type CategoryFormState =
  | { error: string } // validation/DB failure
  | { success: string } // DB ok + notification ok
  | {
      dbSuccess: string; // DB ok, notification failed
      notify: { failed: true; message: string };
      event: StorefrontEvent;
      retryRedirectTo?: string;
    }
  | null;

async function requireSession() {
  if (!(await hasAdminSession())) {
    await logout();
    redirect("/login");
  }
}

const categorySchema = z.object({
  slug: z.string().min(1, "Slug is required."),
  name: z.string().min(1, "Name is required."),
  tagline: z.string().min(1, "Tagline is required."),
  description: z.string().min(1, "Description is required."),
  intro: z.string().min(1, "Intro is required."),
  image: z.string().min(1, "Image URL is required."),
  accent: z.string().min(1, "Accent is required."),
  subcategories: z.array(z.string()).default([]),
  seo_note: z.string().min(1, "SEO note is required."),
});

function parseLines(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseCategoryForm(formData: FormData): CategoryInput | { error: string } {
  const parsed = categorySchema.safeParse({
    slug: String(formData.get("slug") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    tagline: String(formData.get("tagline") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    intro: String(formData.get("intro") ?? "").trim(),
    image: String(formData.get("image") ?? "").trim(),
    accent: String(formData.get("accent") ?? "").trim(),
    subcategories: parseLines(formData.get("subcategories")),
    seo_note: String(formData.get("seo_note") ?? "").trim(),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first ? first.message : "Invalid category data." };
  }
  return parsed.data;
}

function friendlyDbError(error: unknown): string {
  const message =
    (error as { message?: string })?.message ??
    (error instanceof Error ? error.message : JSON.stringify(error).slice(0, 300));
  if (/duplicate key|unique/i.test(message)) {
    return "A category with this slug already exists.";
  }
  return `Database error: ${message}`;
}

export async function createCategoryAction(
  _prev: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireSession();
  const input = parseCategoryForm(formData);
  if ("error" in input) return { error: input.error };
  let newId: string;
  try {
    newId = await createCategory(input);
  } catch (error) {
    return { error: friendlyDbError(error) };
  }

  const event: StorefrontEvent = { type: "category.created", categoryId: newId };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    return {
      dbSuccess: "Category created.",
      notify: { failed: true, message: notify.message },
      event,
      retryRedirectTo: `/categories/${newId}?created=1`,
    };
  }
  // redirect() throws a control-flow error — keep it OUTSIDE try/catch.
  redirect(`/categories/${newId}?created=1`);
}

export async function updateCategoryAction(
  _prev: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing category id." };
  const input = parseCategoryForm(formData);
  if ("error" in input) return { error: input.error };

  // The event carries the PREVIOUS slug when it changed — read the row
  // BEFORE the mutation.
  let oldSlug: string | null = null;
  try {
    const current = await getCategory(id);
    if (current) oldSlug = current.slug;
  } catch (error) {
    return { error: friendlyDbError(error) };
  }

  try {
    await updateCategory(id, input);
  } catch (error) {
    return { error: friendlyDbError(error) };
  }

  const event: StorefrontEvent = {
    type: "category.updated",
    categoryId: id,
    ...(oldSlug !== null && oldSlug !== input.slug ? { previousSlug: oldSlug } : {}),
  };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    return {
      dbSuccess: "Category saved.",
      notify: { failed: true, message: notify.message },
      event,
    };
  }
  return { success: "Category saved. Storefront revalidated." };
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Capture the slug BEFORE deleting — the event needs it.
  let oldSlug: string | null = null;
  try {
    const current = await getCategory(id);
    if (current) oldSlug = current.slug;
  } catch {
    redirect(`/categories/${id}?error=delete-failed`);
  }
  try {
    await deleteCategory(id);
  } catch (error) {
    const message = /foreign key|violates/i.test(String(error))
      ? "This category still has products (products.category_id is RESTRICT) — move or reassign them first."
      : "delete-failed";
    redirect(`/categories/${id}?error=${encodeURIComponent(message)}`);
  }
  const event: StorefrontEvent = {
    type: "category.deleted",
    categoryId: id,
    ...(oldSlug !== null ? { slug: oldSlug } : {}),
  };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    // The list page renders the retry banner for the deleted row.
    redirect(withNotifyFailed("/categories?deleted=1", event, notify.message));
  }
  redirect("/categories?deleted=1");
}

// ── Manual storefront refresh (operator-triggered) ────────────────────

/**
 * "Revalidate storefront" button on the category page — same notification
 * path as the automatic mutations (one system, no special cases).
 */
export async function refreshCategoryAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("category_id") ?? "");
  if (!id) return;
  const event: StorefrontEvent = { type: "category.refresh", categoryId: id };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    redirect(withNotifyFailed(`/categories/${id}`, event, notify.message));
  }
  redirect(`/categories/${id}?refreshed=1`);
}
