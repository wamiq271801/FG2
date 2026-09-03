"use server";

import { hasAdminSession, logout } from "@/lib/auth";
import { notifyStorefront } from "@/lib/notify";
import { withNotifyFailed, type StorefrontEvent } from "@/lib/notify-types";
import { setReviewStatus, MigrationRequiredError } from "@/lib/data/reviews";
import { redirect } from "next/navigation";

/**
 * Review moderation + storefront cache-invalidation notifications.
 * Moderation transitions are pending -> approved / pending -> rejected;
 * after a successful status update exactly ONE notifyStorefront event
 * (review.approved / review.rejected with the review's productId) goes
 * out. A failed notification never rolls back the moderation decision.
 */

export type ModerationState =
  | { error: string }
  | {
      dbSuccess: string; // DB ok, notification failed
      notify: { failed: true; message: string };
      event: StorefrontEvent;
    }
  | null;

async function requireSession() {
  if (!(await hasAdminSession())) {
    await logout();
    redirect("/login");
  }
}

async function moderate(
  _prev: ModerationState,
  formData: FormData,
  status: "approved" | "rejected"
): Promise<ModerationState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing review id." };
  let productId: string | null;
  try {
    productId = await setReviewStatus(id, status);
  } catch (error) {
    if (error instanceof MigrationRequiredError) {
      return { error: error.message };
    }
    return {
      error: `Database error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (productId === null) {
    return { error: "Review not found — it may have been removed already." };
  }

  const event: StorefrontEvent =
    status === "approved"
      ? { type: "review.approved", productId }
      : { type: "review.rejected", productId };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    return {
      dbSuccess: status === "approved" ? "Review approved." : "Review rejected.",
      notify: { failed: true, message: notify.message },
      event,
    };
  }
  return null;
}

/** pending -> approved (the only approval transition). */
export async function approveReviewAction(
  prev: ModerationState,
  formData: FormData
): Promise<ModerationState> {
  return moderate(prev, formData, "approved");
}

/** pending -> rejected (the only rejection transition). */
export async function rejectReviewAction(
  prev: ModerationState,
  formData: FormData
): Promise<ModerationState> {
  return moderate(prev, formData, "rejected");
}

// ── Manual storefront refresh (operator-triggered) ────────────────────

/**
 * "Revalidate storefront" control on the reviews page. Without a
 * product_id the event refreshes the WHOLE review domain — the same
 * deterministic path every review event takes.
 */
export async function refreshReviewAction(formData: FormData): Promise<void> {
  await requireSession();
  const statusTab = String(formData.get("status") ?? "").trim();
  const page = String(formData.get("page") ?? "").trim();
  const base = `/reviews${statusTab ? `?status=${encodeURIComponent(statusTab)}` : ""}`;
  const back = `${base}${page && page !== "1" ? `${statusTab ? "&" : "?"}page=${encodeURIComponent(page)}` : ""}`;

  const event: StorefrontEvent = { type: "review.refresh" };
  const notify = await notifyStorefront(event);
  if (!notify.ok) {
    redirect(withNotifyFailed(back, event, notify.message));
  }
  redirect(`${back}${statusTab ? "&" : "?"}refreshed=1`);
}
