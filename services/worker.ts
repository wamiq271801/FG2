"use client";

import { createClient } from "@/lib/supabase/client";
import { resolveWorkerError, type WorkerError } from "@/lib/auth-errors";

const WORKER_BASE = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

type WorkerResponse = {
  success: boolean;
  data?: unknown;
  error?: WorkerError;
};

async function workerPost(path: string, body: unknown, auth?: string): Promise<WorkerResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["Authorization"] = `Bearer ${auth}`;

  const res = await fetch(`${WORKER_BASE}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  return json as WorkerResponse;
}

export async function register(
  email: string,
  password: string,
  turnstileToken: string
): Promise<{ success: boolean; error?: string }> {
  const result = await workerPost("auth/register", { email, password, turnstileToken });
  if (!result.success) return { success: false, error: resolveWorkerError(result.error) };
  return { success: true };
}

export async function resendSignupOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const result = await workerPost("auth/resend-signup", { email });
  if (!result.success) return { success: false, error: resolveWorkerError(result.error) };
  return { success: true };
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const result = await workerPost("auth/reset-password", { email });
  if (!result.success) return { success: false, error: resolveWorkerError(result.error) };
  return { success: true };
}

export async function createOrder(addressId: string, idempotencyKey: string, expectedTotal?: number): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  total?: number;
  subtotal?: number;
  discountTotal?: number;
  shippingTotal?: number;
  idempotent?: boolean;
  priceChanged?: boolean;
  updatedTotal?: number;
  error?: string;
}> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) return { success: false, error: "Please sign in to place your order." };

  const result = await workerPost(
    "orders",
    { addressId, idempotencyKey, ...(expectedTotal !== undefined ? { expectedTotal } : {}) },
    token
  );

  if (!result.success) {
    // Price-change is a special case — not a failure, needs UI confirmation
    if ((result.error as unknown as { code: string })?.code === "ORDER_PRICE_CHANGED") {
      return { success: false, priceChanged: true, error: resolveWorkerError(result.error) };
    }
    return { success: false, error: resolveWorkerError(result.error) };
  }

  const d = result.data as {
    orderId?: string; orderNumber?: string; total?: number;
    subtotal?: number; discountTotal?: number; shippingTotal?: number;
    idempotent?: boolean;
  };
  return {
    success: true,
    orderId:       d?.orderId,
    orderNumber:   d?.orderNumber,
    total:         d?.total,
    subtotal:      d?.subtotal,
    discountTotal: d?.discountTotal,
    shippingTotal: d?.shippingTotal,
    idempotent:    d?.idempotent,
  };
}

export type CheckoutSummaryItem = {
  productId: string;
  slug: string;
  sku: string;
  name: string;
  visualKey: string;
  accent: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  lineTotal: number;
  availability: string;
  stock: number | null;
  purchasable: boolean;
};

export type CheckoutSummary = {
  items: CheckoutSummaryItem[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  canCheckout: boolean;
};

export async function getCheckoutSummary(): Promise<{ success: boolean; summary?: CheckoutSummary; error?: string }> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { success: false, error: "Please sign in to continue." };

  const res = await fetch(`${WORKER_BASE}/orders/summary`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!res) return { success: false, error: "Network error. Please try again." };

  const json = await res.json().catch(() => ({})) as { success: boolean; data?: CheckoutSummary; error?: WorkerError };
  if (!json.success) return { success: false, error: resolveWorkerError(json.error) };
  return { success: true, summary: json.data };
}
