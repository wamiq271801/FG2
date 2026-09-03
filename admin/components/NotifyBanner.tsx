"use client";

import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  retryNotificationAction,
  type RetryNotifyState,
} from "@/app/(protected)/notify-actions";
import { encodeEvent, type StorefrontEvent } from "@/lib/notify-types";
import { FormMessage, SubmitButton } from "@/components/ui";

/**
 * Failure surface for the storefront notification system.
 *
 * Rendered whenever a database mutation succeeded but the notification
 * to the storefront failed: the DB change is committed (never rolled
 * back), so the operator sees BOTH facts and can trigger exactly one
 * explicit new attempt via [Retry Invalidation]. Copy speaks domain
 * intent — never cache tags.
 */
export function NotifyBanner({
  dbMessage,
  message,
  event,
  redirectTo,
}: {
  dbMessage: string;
  message: string;
  event: StorefrontEvent;
  redirectTo?: string;
}) {
  const [retryState, retry] = useActionState<RetryNotifyState, FormData>(
    retryNotificationAction,
    null
  );

  if (retryState && "success" in retryState) {
    return (
      <FormMessage kind="success">
        {`${dbMessage} ${retryState.success}`}
      </FormMessage>
    );
  }

  const currentMessage = retryState && "error" in retryState ? retryState.error : message;

  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-warn/40 bg-warn-soft px-3 py-2.5 text-sm"
    >
      <p className="flex items-center gap-2 font-medium text-warn">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        {dbMessage} — storefront notification FAILED
      </p>
      <p className="text-foreground/80">{currentMessage}</p>
      <p className="text-xs text-muted">
        The database was updated, but the public storefront may serve stale data
        until this succeeds. No automatic retries are performed.
      </p>
      <form action={retry}>
        <input type="hidden" name="evt" value={encodeEvent(event)} />
        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
        <SubmitButton size="sm" variant="outline" pendingLabel="Retrying…">
          Retry Invalidation
        </SubmitButton>
      </form>
    </div>
  );
}
