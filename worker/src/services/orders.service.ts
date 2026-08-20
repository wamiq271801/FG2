import type { Env } from "../config/env";
import { supabaseRestFetch } from "../lib/supabase";
import { fail, success } from "../lib/response";
import { validateOrderRequest } from "../lib/validation";
import { checkRateLimit, clientIp } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/auth";

export async function handleCreateOrder(request: Request, env: Env): Promise<Response> {
  const user = await requireAuth(env, request);
  if (!user) return fail("UNAUTHORIZED", "Authentication required.", 401);

  const ip = clientIp(request);
  const allowed = await checkRateLimit(env, `orders:${user.id}`, 5, 900);
  if (!allowed) return fail("RATE_LIMITED", "Too many checkout attempts. Please wait.", 429);

  const body = await request.json().catch(() => null);
  const validation = validateOrderRequest(body);
  if (!validation.ok) return fail("VALIDATION_ERROR", validation.error);

  const { addressId, idempotencyKey } = validation.data;

  // Single authoritative RPC — transactional, validates everything, creates order+items+timeline, clears cart
  const result = await supabaseRestFetch(
    env,
    "POST",
    "/rest/v1/rpc/create_order",
    {
      p_user_id: user.id,
      p_address_id: addressId,
      p_idempotency_key: idempotencyKey,
    }
  );

  if (!result.ok) {
    return fail("ORDER_FAILED", "Unable to create order. Please try again.", 500);
  }

  const data = result.data as Record<string, unknown>;
  if (data?.error) {
    const errCode = data.error as string;
    const errMap: Record<string, { code: string; message: string }> = {
      ADDRESS_NOT_FOUND: { code: "ADDRESS_NOT_FOUND", message: "Selected address not found or not owned by you." },
      CART_EMPTY: { code: "CART_EMPTY", message: "Your cart is empty." },
      PRODUCT_UNAVAILABLE: { code: "PRODUCT_UNAVAILABLE", message: `Product "${data.slug}" is no longer available.` },
      OUT_OF_STOCK: { code: "OUT_OF_STOCK", message: `${data.name} is out of stock.` },
      VARIANT_UNAVAILABLE: { code: "VARIANT_UNAVAILABLE", message: `Variant for ${data.slug} is no longer available.` },
      VARIANT_OUT_OF_STOCK: { code: "VARIANT_OUT_OF_STOCK", message: `${data.name} (${data.variant}) is out of stock.` },
    };
    const err = errMap[errCode] ?? { code: "ORDER_FAILED", message: "Unable to create order." };
    return fail(err.code, err.message);
  }

  return success(data);
}
