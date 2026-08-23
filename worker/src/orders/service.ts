/**
 * Orders service — Phase 9
 * Moved from services/orders.service.ts. Imports updated to new paths.
 * Inline error map replaced with imports from http/errors.ts (TASK 9.6).
 */

import type { Env } from "../config/env";
import { supabaseRestFetch } from "../infrastructure/supabase";
import { fail, success } from "../http/response";
import { type WorkerErrorCode } from "../http/errors";
import { validateOrderRequest } from "./validation";
import { checkOrderCreationUser, checkOrderCreationIp, clientIp } from "../security/rate-limit";
import { requireAuth } from "../security/auth";

// ─── Create Order ──────────────────────────────────────────────────────────
export async function handleCreateOrder(request: Request, env: Env): Promise<Response> {
  // 1. Verify JWT
  const user = await requireAuth(env, request);
  if (!user) return fail("UNAUTHORIZED", undefined, 401);

  const ip = clientIp(request);

  // 2. User rate limit: 5 per 15 minutes (per implementation.md)
  const userResult = await checkOrderCreationUser(env, user.id);
  if (!userResult.allowed) {
    if (userResult.reason === "infrastructure_error") {
      return fail("RATE_LIMITED", undefined, 429);
    }
    return fail("RATE_LIMITED", "Too many checkout attempts. Please wait a moment.", 429);
  }

  // 3. IP burst protection: 10 per 5 minutes (per implementation.md)
  const ipResult = await checkOrderCreationIp(env, ip);
  if (!ipResult.allowed) {
    if (ipResult.reason === "infrastructure_error") {
      return fail("RATE_LIMITED", undefined, 429);
    }
    return fail("RATE_LIMITED", "Too many requests. Please try again shortly.", 429);
  }

  // 4. Validate minimal payload
  const body = await request.json().catch(() => null);
  const validation = validateOrderRequest(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { addressId, idempotencyKey } = validation.data;

  // Optional expected total for price-change detection
  const expectedTotal =
    typeof (body as Record<string, unknown>)?.expectedTotal === "number"
      ? (body as Record<string, unknown>).expectedTotal as number
      : null;

  // 5. Call atomic create_order RPC (service_role only)
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/rpc/create_order",
    {
      p_user_id:         user.id,
      p_address_id:      addressId,
      p_idempotency_key: idempotencyKey,
      p_expected_total:  expectedTotal,
    }
  );

  if (!result.ok) return fail("ORDER_FAILED", undefined, 500);

  const data = result.data as Record<string, unknown>;

  // 6. Map RPC error codes — all errors resolved through the global error source
  if (data?.error) {
    const errCode = data.error as string;

    // ORDER_PRICE_CHANGED returns 409 with updated totals embedded in the error data.
    // The frontend reads error.message and re-fetches summary for display.
    if (errCode === "ORDER_PRICE_CHANGED") {
      return fail("ORDER_PRICE_CHANGED", undefined, 409);
    }

    // Map RPC-internal codes to global prefixed codes.
    // Only OUT_OF_STOCK carries dynamic data (product name, stock count) so
    // its message is constructed here and passed as the override.
    const codeMap: Record<string, WorkerErrorCode> = {
      ADDRESS_NOT_FOUND:       "ORDER_ADDRESS_NOT_FOUND",
      CART_EMPTY:              "ORDER_CART_EMPTY",
      PRODUCT_UNAVAILABLE:     "INVENTORY_UNAVAILABLE",
      PRODUCT_NOT_PURCHASABLE: "INVENTORY_NOT_PURCHASABLE",
      OUT_OF_STOCK:            "INVENTORY_OUT_OF_STOCK",
    };

    const mappedCode: WorkerErrorCode = codeMap[errCode] ?? errCode;

    // For out-of-stock, include the product name and counts in the message.
    const messageOverride = errCode === "OUT_OF_STOCK"
      ? `${data.name ?? "A product"} is out of stock (${data.stock ?? 0} remaining, ${data.requested ?? "?"} requested).`
      : undefined;

    const httpStatus =
      errCode === "OUT_OF_STOCK" || errCode === "PRODUCT_NOT_PURCHASABLE" ? 409 : 422;

    return fail(mappedCode, messageOverride, httpStatus);
  }

  // 7. Success
  return success({
    orderId:       data.orderId,
    orderNumber:   data.orderNumber,
    total:         data.total,
    subtotal:      data.subtotal,
    discountTotal: data.discountTotal,
    shippingTotal: data.shippingTotal,
    idempotent:    data.idempotent ?? false,
  });
}

// ─── Checkout Summary ──────────────────────────────────────────────────────
export async function handleCheckoutSummary(request: Request, env: Env): Promise<Response> {
  const user = await requireAuth(env, request);
  if (!user) return fail("UNAUTHORIZED", undefined, 401);

  const result = await supabaseRestFetch(
    env,
    "GET",
    `/rest/v1/cart_items?user_id=eq.${encodeURIComponent(user.id)}` +
    `&select=product_id,quantity,product:products!fk_cart_items_product_id(` +
    `id,slug,name,price,compare_at,stock,is_preorder,is_active,visual_key,accent,sku)`,
  );

  if (!result.ok) return fail("SUMMARY_FAILED", undefined, 500);

  const rows = result.data as {
    product_id: string;
    quantity: number;
    product: {
      id: string; slug: string; name: string;
      price: number; compare_at: number | null;
      stock: number | null; is_preorder: boolean; is_active: boolean;
      visual_key: string; accent: string; sku: string;
    } | null;
  }[];

  if (!rows || rows.length === 0) {
    return success({ items: [], subtotal: 0, discountTotal: 0, shippingTotal: 0, total: 0, canCheckout: false });
  }

  const FREE_SHIPPING      = 4990;
  const FLAT_SHIPPING      = 149;
  const LOW_STOCK_THRESHOLD = 5;

  let subtotal      = 0;
  let discountTotal = 0;

  const items = rows.map((row) => {
    const p = row.product;
    if (!p) return null;

    const unitPrice    = p.price;
    const lineDiscount = p.compare_at && p.compare_at > p.price
      ? (p.compare_at - p.price) * row.quantity
      : 0;
    const lineTotal = unitPrice * row.quantity;

    subtotal      += lineTotal;
    discountTotal += lineDiscount;

    let availability: string;
    if (!p.is_active)                           availability = "out-of-stock";
    else if (p.is_preorder)                     availability = "preorder";
    else if (p.stock === null || p.stock === 0) availability = "out-of-stock";
    else if (p.stock <= LOW_STOCK_THRESHOLD)    availability = "low-stock";
    else                                        availability = "in-stock";

    const purchasable =
      p.is_active &&
      p.stock !== null &&
      (p.is_preorder || p.stock >= row.quantity);

    return {
      productId:  p.id,
      slug:       p.slug,
      sku:        p.sku,
      name:       p.name,
      visualKey:  p.visual_key,
      accent:     p.accent,
      quantity:   row.quantity,
      unitPrice,
      lineDiscount,
      lineTotal,
      availability,
      stock:      p.stock,
      purchasable,
    };
  }).filter(Boolean);

  const shippingTotal = subtotal - discountTotal >= FREE_SHIPPING ? 0 : FLAT_SHIPPING;
  const total         = subtotal - discountTotal + shippingTotal;

  return success({
    items,
    subtotal,
    discountTotal,
    shippingTotal,
    total,
    canCheckout: items.length > 0 && items.every((i) => i!.purchasable),
  });
}
