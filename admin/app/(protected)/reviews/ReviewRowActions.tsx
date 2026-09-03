"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import {
  approveReviewAction,
  rejectReviewAction,
  type ModerationState,
} from "./actions";
import { NotifyBanner } from "@/components/NotifyBanner";
import { FormMessage, SubmitButton } from "@/components/ui";

/**
 * Moderation controls for a PENDING review: Approve or Reject. Other
 * statuses have no actions — the spec's only transitions are
 * pending -> approved and pending -> rejected.
 */
export function ReviewRowActions({ reviewId }: { reviewId: string }) {
  const [approveState, approve] = useActionState<ModerationState, FormData>(
    approveReviewAction,
    null
  );
  const [rejectState, reject] = useActionState<ModerationState, FormData>(
    rejectReviewAction,
    null
  );
  const error =
    (approveState && "error" in approveState ? approveState.error : null) ??
    (rejectState && "error" in rejectState ? rejectState.error : null);
  const notifyFailure =
    (approveState && "dbSuccess" in approveState ? approveState : null) ??
    (rejectState && "dbSuccess" in rejectState ? rejectState : null);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <form action={approve}>
          <input type="hidden" name="id" value={reviewId} />
          <SubmitButton variant="ok" size="sm" pendingLabel="Approving…">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Approve
          </SubmitButton>
        </form>
        <form action={reject}>
          <input type="hidden" name="id" value={reviewId} />
          <SubmitButton variant="danger" size="sm" pendingLabel="Rejecting…">
            <X className="h-3.5 w-3.5" aria-hidden />
            Reject
          </SubmitButton>
        </form>
      </div>
      {error && <FormMessage kind="error">{error}</FormMessage>}
      {notifyFailure && (
        <NotifyBanner
          dbMessage={notifyFailure.dbSuccess}
          message={notifyFailure.notify.message}
          event={notifyFailure.event}
        />
      )}
    </div>
  );
}
