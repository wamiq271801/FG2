/**
 * Orders — input validation — Phase 9
 *
 * validateOrderRequest and validateCartQuantity moved here from
 * lib/validation.ts. These are order-domain concerns.
 */

export function validateOrderRequest(body: unknown): {
  ok: true;
  data: { addressId: string; idempotencyKey: string };
} | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request." };
  const b = body as Record<string, unknown>;
  const addressId      = typeof b.addressId      === "string" ? b.addressId.trim()      : "";
  const idempotencyKey = typeof b.idempotencyKey === "string" ? b.idempotencyKey.trim() : "";
  if (!addressId)                                    return { ok: false, error: "A delivery address is required." };
  if (!idempotencyKey || idempotencyKey.length > 100) return { ok: false, error: "Invalid checkout request." };
  return { ok: true, data: { addressId, idempotencyKey } };
}

/**
 * Cart quantity bounds — mirrors the DB constraint: quantity BETWEEN 1 AND 99.
 * Per implementation.md: 99 is the confirmed business maximum.
 */
export const CART_QUANTITY_MIN = 1;
export const CART_QUANTITY_MAX = 99;

export function validateCartQuantity(quantity: unknown): {
  ok: true;
  value: number;
} | { ok: false; error: string } {
  const n = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isInteger(n)) return { ok: false, error: "Quantity must be a whole number." };
  if (n < CART_QUANTITY_MIN) return { ok: false, error: `Quantity must be at least ${CART_QUANTITY_MIN}.` };
  if (n > CART_QUANTITY_MAX) return { ok: false, error: `Quantity cannot exceed ${CART_QUANTITY_MAX}.` };
  return { ok: true, value: n };
}
