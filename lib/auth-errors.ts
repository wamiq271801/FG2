/**
 * Centralized authentication error contract.
 *
 * Each error has a stable internal code (for logging, testing, programmatic use)
 * and a user-facing title (the ONLY text shown in the UI).
 *
 * The UI must never display the code, raw Supabase messages, HTTP details,
 * SQL errors, or any internal implementation information.
 */

export type AuthErrorCode =
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "TURNSTILE_FAILED"
  | "EMAIL_EXISTS"
  | "SIGNUP_REJECTED"
  | "SIGNUP_FAILED"
  | "RESEND_FAILED"
  | "RESET_FAILED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "SIGNIN_FAILED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

const ERROR_TITLES: Record<AuthErrorCode, string> = {
  RATE_LIMITED: "Too many attempts",
  VALIDATION_ERROR: "Please check your details",
  TURNSTILE_FAILED: "Verification failed",
  EMAIL_EXISTS: "An account with this email already exists",
  SIGNUP_REJECTED: "Registration unavailable",
  SIGNUP_FAILED: "Unable to create account",
  RESEND_FAILED: "Unable to resend code",
  RESET_FAILED: "Unable to send reset link",
  OTP_INVALID: "Invalid verification code",
  OTP_EXPIRED: "That code has expired",
  SIGNIN_FAILED: "Incorrect email or password",
  NETWORK_ERROR: "Network error — please try again",
  UNKNOWN_ERROR: "Something went wrong",
};

export function errorTitle(code: AuthErrorCode): string {
  return ERROR_TITLES[code] ?? ERROR_TITLES.UNKNOWN_ERROR;
}

/** Shape returned by Worker error responses. */
export type WorkerError = {
  code: string;
  title: string;
};

/**
 * Map a Worker error response to a user-facing title.
 * Falls back to the provided title from the response, or a generic message.
 */
export function resolveWorkerError(err?: WorkerError | null): string {
  if (!err) return ERROR_TITLES.UNKNOWN_ERROR;
  // If the code matches a known AuthErrorCode, prefer our canonical title
  if (err.code in ERROR_TITLES) {
    return ERROR_TITLES[err.code as AuthErrorCode];
  }
  // Otherwise use the title the Worker sent (already user-safe)
  return err.title || ERROR_TITLES.UNKNOWN_ERROR;
}
