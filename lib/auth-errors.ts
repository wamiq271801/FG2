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
  | "OTP_RESEND_RATE_LIMITED"
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
  OTP_RESEND_RATE_LIMITED: "Too many verification requests",
  VALIDATION_ERROR: "Please check your details",
  TURNSTILE_FAILED: "Verification failed",
  EMAIL_EXISTS: "An account with this email already exists",
  SIGNUP_REJECTED: "Registration unavailable",
  SIGNUP_FAILED: "Unable to create account",
  RESEND_FAILED: "Unable to resend code",
  RESET_FAILED: "Unable to send reset code",
  OTP_INVALID: "Invalid verification code",
  OTP_EXPIRED: "That code has expired",
  SIGNIN_FAILED: "Incorrect email or password",
  NETWORK_ERROR: "Network error — please try again",
  UNKNOWN_ERROR: "Something went wrong",
};

export function errorTitle(code: AuthErrorCode): string {
  return ERROR_TITLES[code] ?? ERROR_TITLES.UNKNOWN_ERROR;
}

/** Shape returned by Worker error responses — Phase 11: { code, message, status } */
export type WorkerError = {
  code: string;
  message: string;
  status: number;
};

/**
 * Extract the user-facing message from a Worker error response.
 * `message` is the ONLY field the frontend should display.
 * Per implementation.md: toast.error(error.message)
 */
export function resolveWorkerError(err?: WorkerError | null): string {
  if (!err) return ERROR_TITLES.UNKNOWN_ERROR;
  // Use the message the Worker sent — already user-safe, never contains
  // code, HTTP status, Supabase internals, or stack traces.
  return err.message || ERROR_TITLES.UNKNOWN_ERROR;
}
