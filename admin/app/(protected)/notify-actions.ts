"use server";

import { redirect } from "next/navigation";
import { hasAdminSession, logout } from "@/lib/auth";
import { notifyStorefront } from "@/lib/notify";
import { decodeEvent } from "@/lib/notify-types";

/**
 * Operator-triggered retry of ONE failed storefront notification.
 *
 * The event arrives base64url-encoded (the same codec the mutation
 * actions used to build the failure redirect / form state), is decoded
 * and strictly validated with zod, and then gets EXACTLY ONE new
 * notifyStorefront attempt. No automatic retry, ever — this action runs
 * only because the operator clicked the button.
 */

export type RetryNotifyState = { error: string } | { success: string } | null;

/** Every privileged action re-verifies the session (actions are endpoints). */
async function requireSession() {
  if (!(await hasAdminSession())) {
    await logout();
    redirect("/login");
  }
}

/** Only same-app paths (starts with exactly one "/") — never external URLs. */
function sanitizeRedirectTo(raw: string): string | undefined {
  const value = raw.trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return undefined;
}

export async function retryNotificationAction(
  _prev: RetryNotifyState,
  formData: FormData
): Promise<RetryNotifyState> {
  await requireSession();

  const event = decodeEvent(String(formData.get("evt") ?? ""));
  if (!event) {
    return { error: "Invalid notification payload — the event could not be decoded." };
  }
  const redirectTo = sanitizeRedirectTo(String(formData.get("redirectTo") ?? ""));

  const result = await notifyStorefront(event);
  if (result.ok) {
    // redirect() throws a control-flow error — this function has no
    // try/catch around it, so the redirect always propagates.
    if (redirectTo) redirect(redirectTo);
    return { success: "Storefront revalidated — the public catalog is up to date." };
  }
  return { error: result.message };
}
