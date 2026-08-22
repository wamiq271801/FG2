/**
 * Global Worker error source — Phase 11 / TASK 11.1
 *
 * Single source for all Worker error responses.
 * No module may define its own error shape or inline error map.
 *
 * Shape: { code, message, status }
 *   code    — stable internal identifier (never displayed to the user)
 *   message — the ONLY field displayed in the UI (toast.error(error.message))
 *   status  — HTTP status code (never displayed to the user)
 *
 * Per implementation.md:
 *   The frontend must display only: toast.error(error.message)
 *   Never display: code, HTTP status, Supabase message, SQL message, stack trace.
 *
 * Error group prefixes:
 *   AUTH_*           — authentication failures
 *   REGISTRATION_*   — registration flow errors
 *   OTP_*            — OTP verification errors
 *   PASSWORD_RESET_* — password reset errors
 *   ORDER_*          — order creation / lifecycle errors
 *   INVENTORY_*      — stock / availability errors
 *   VALIDATION_*     — input validation errors
 *   RATE_LIMIT_*     — rate limit violations
 *   INTERNAL_*       — unexpected server errors
 */

export type WorkerErrorCode =
  // Auth
  | "UNAUTHORIZED"
  // Registration
  | "RATE_LIMITED"
  | "OTP_RESEND_RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "TURNSTILE_FAILED"
  | "EMAIL_EXISTS"
  | "SIGNUP_REJECTED"
  | "SIGNUP_FAILED"
  | "RESEND_FAILED"
  // Password reset
  | "RESET_FAILED"
  // OTP
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  // Auth sign-in
  | "SIGNIN_FAILED"
  // Orders — ORDER_* prefix
  | "ORDER_FAILED"
  | "ORDER_PRICE_CHANGED"
  | "ORDER_ADDRESS_NOT_FOUND"
  | "ORDER_CART_EMPTY"
  // Inventory — INVENTORY_* prefix
  | "INVENTORY_UNAVAILABLE"
  | "INVENTORY_NOT_PURCHASABLE"
  | "INVENTORY_OUT_OF_STOCK"
  | "INVENTORY_CANNOT_CANCEL"
  | "INVENTORY_CANNOT_RETURN"
  // Checkout summary
  | "SUMMARY_FAILED"
  // Generic
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | string; // RPC-sourced codes pass through unchanged

/**
 * Canonical user-facing messages for all known error codes.
 * `message` is the ONLY text ever shown in the UI.
 */
const MESSAGES: Partial<Record<string, string>> = {
  // Auth
  UNAUTHORIZED:                "Authentication required.",
  // Rate limits
  RATE_LIMITED:                "Too many attempts. Please wait a moment.",
  OTP_RESEND_RATE_LIMITED:     "Too many verification requests. Please wait before trying again.",
  // Registration
  VALIDATION_ERROR:            "Please check your details.",
  TURNSTILE_FAILED:            "Verification failed. Please try again.",
  EMAIL_EXISTS:                "An account with this email already exists.",
  SIGNUP_REJECTED:             "Registration is currently unavailable.",
  SIGNUP_FAILED:               "Unable to create account. Please try again.",
  RESEND_FAILED:               "Unable to resend verification code.",
  // Password reset
  RESET_FAILED:                "Unable to send reset link.",
  // OTP
  OTP_INVALID:                 "Invalid verification code.",
  OTP_EXPIRED:                 "That code has expired. Please request a new one.",
  // Sign-in
  SIGNIN_FAILED:               "Incorrect email or password.",
  // Orders
  ORDER_FAILED:                "Unable to create order. Please try again.",
  ORDER_PRICE_CHANGED:         "Prices changed since your last checkout. Please review and confirm.",
  ORDER_ADDRESS_NOT_FOUND:     "Selected address not found. Please choose another.",
  ORDER_CART_EMPTY:            "Your cart is empty.",
  // Inventory
  INVENTORY_UNAVAILABLE:       "A product in your cart is no longer available.",
  INVENTORY_NOT_PURCHASABLE:   "This product is not currently available.",
  INVENTORY_OUT_OF_STOCK:      "A product in your cart is out of stock.",
  INVENTORY_CANNOT_CANCEL:     "This order can no longer be cancelled.",
  INVENTORY_CANNOT_RETURN:     "Only delivered orders can be returned.",
  // Checkout
  SUMMARY_FAILED:              "Unable to load checkout summary. Please try again.",
  // Generic
  NOT_FOUND:                   "The requested resource was not found.",
  INTERNAL_ERROR:              "An unexpected error occurred. Please try again.",
};

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * Build a standardised Worker error response.
 *
 * Response body: { success: false, error: { code, message, status } }
 *   code    — internal identifier
 *   message — user-safe display text (the ONLY field shown in the UI)
 *   status  — mirrors the HTTP status
 */
export function workerError(
  code: WorkerErrorCode,
  message?: string,
  status = 422
): Response {
  const displayMessage = message ?? MESSAGES[code] ?? FALLBACK_MESSAGE;
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message: displayMessage, status },
    }),
    {
      status,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type, Authorization",
      },
    }
  );
}
