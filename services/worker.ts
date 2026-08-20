"use client";

import { createClient } from "@/lib/supabase/client";

const WORKER_BASE = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

async function workerPost(path: string, body: unknown, auth?: string): Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["Authorization"] = `Bearer ${auth}`;

  const res = await fetch(`${WORKER_BASE}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  return json as { success: boolean; data?: unknown; error?: { code: string; message: string } };
}

// Register a new account. The Worker handles all security checks (Turnstile,
// rate limits, authorization gate) and calls Supabase signup server-to-server.
// Returns success when the user has been created and a verification email sent.
export async function register(
  fullName: string,
  email: string,
  password: string,
  turnstileToken: string
): Promise<{ success: boolean; error?: string }> {
  const result = await workerPost("auth/register", { fullName, email, password, turnstileToken });
  if (!result.success) return { success: false, error: result.error?.message ?? "Unable to create account." };
  return { success: true };
}

export async function resendSignupOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const result = await workerPost("auth/resend-signup", { email });
  if (!result.success) return { success: false, error: result.error?.message ?? "Unable to send code." };
  return { success: true };
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const result = await workerPost("auth/reset-password", { email });
  if (!result.success) return { success: false, error: result.error?.message ?? "Unable to send reset link." };
  return { success: true };
}

export async function createOrder(addressId: string, idempotencyKey: string): Promise<{ success: boolean; orderId?: string; total?: number; error?: string }> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) return { success: false, error: "Please sign in to place your order." };

  const result = await workerPost("orders", { addressId, idempotencyKey }, token);
  if (!result.success) return { success: false, error: result.error?.message ?? "Unable to place order." };

  const orderData = result.data as { orderId?: string; total?: number; idempotent?: boolean };
  return { success: true, orderId: orderData?.orderId, total: orderData?.total };
}
