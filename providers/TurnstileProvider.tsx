"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Turnstile action identifiers — each protected client action maps to
 * exactly one action string that the Worker validates server-side.
 */
export type TurnstileAction = "signup" | "otp_resend" | "password_reset";

type PendingRequest = {
  action: TurnstileAction;
  resolve: (token: string) => void;
  reject: (err: Error) => void;
};

type TurnstileContextValue = {
  /**
   * Request a fresh Turnstile token for the given action.
   * Opens the managed dialog, waits for verification, returns a one-time token.
   * Rejects if the user cancels, the widget errors permanently, or the component unmounts.
   */
  requestTurnstile: (action: TurnstileAction) => Promise<string>;
};

const TurnstileContext = createContext<TurnstileContextValue | null>(null);

export function useTurnstile(): TurnstileContextValue {
  const ctx = useContext(TurnstileContext);
  if (!ctx) throw new Error("useTurnstile must be used within TurnstileProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Script loading — singleton
// ---------------------------------------------------------------------------

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstileLoad";

let scriptLoading: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<void>((resolve) => {
    const prev = (window as unknown as { __onTurnstileLoad?: () => void })
      .__onTurnstileLoad;
    (
      window as unknown as { __onTurnstileLoad?: () => void }
    ).__onTurnstileLoad = () => {
      prev?.();
      resolve();
    };
    const existing = document.querySelector(
      `script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]`
    );
    if (existing) return;
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  });
  return scriptLoading;
}

// ---------------------------------------------------------------------------
// Cloudflare global type
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          action?: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          "timeout-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
          "refresh-expired"?: "auto" | "manual";
          "refresh-timeout"?: "auto" | "manual";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

export function TurnstileProvider({ children }: { children: React.ReactNode }) {
  const pendingRef = useRef<PendingRequest | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<TurnstileAction | null>(
    null
  );

  // Resolve the current pending request with a token and close the dialog.
  const resolveRequest = useCallback((token: string) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setCurrentAction(null);
    setOpen(false);
    pending?.resolve(token);
  }, []);

  // Reject the current pending request and close the dialog.
  const rejectRequest = useCallback((err: Error) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setCurrentAction(null);
    setOpen(false);
    pending?.reject(err);
  }, []);

  // Cleanup the widget without resolving/rejecting (e.g. dialog closed by user).
  const cleanupWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {}
      widgetIdRef.current = null;
    }
  }, []);

  // Called when dialog's open state changes (e.g. user presses Escape or clicks overlay).
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && pendingRef.current) {
        // User dismissed the dialog — reject the request.
        cleanupWidget();
        rejectRequest(new Error("Turnstile cancelled"));
      }
      setOpen(nextOpen);
    },
    [cleanupWidget, rejectRequest]
  );

  // Expose requestTurnstile to the application.
  const requestTurnstile = useCallback(
    (action: TurnstileAction): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        // Only one active request at a time.
        if (pendingRef.current) {
          reject(new Error("Turnstile verification already in progress"));
          return;
        }

        pendingRef.current = { action, resolve, reject };
        setCurrentAction(action);
        setOpen(true);

        // The widget is rendered inside TurnstileDialog which uses a
        // containerRef. We render the widget once the dialog is open and
        // the container is available. The TurnstileDialog component
        // handles widget creation/teardown based on `open` and `currentAction`.
      });
    },
    []
  );

  // Called by TurnstileDialog when the container is mounted and ready.
  const onWidgetReady = useCallback(
    async (container: HTMLDivElement) => {
      containerRef.current = container;
      const pending = pendingRef.current;
      if (!pending) return;

      cleanupWidget();
      await loadTurnstileScript();
      if (!window.turnstile || !containerRef.current || !pendingRef.current) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        action: pending.action,
        theme: "light",
        size: "normal",
        appearance: "always",
        "refresh-expired": "auto",
        "refresh-timeout": "auto",
        callback: (token: string) => {
          resolveRequest(token);
        },
        "expired-callback": () => {
          // Automatic refresh is enabled — Cloudflare will re-trigger callback.
          // This fires only on permanent expiration.
        },
        "error-callback": () => {
          rejectRequest(new Error("Turnstile verification failed"));
        },
        "timeout-callback": () => {
          // Automatic retry is enabled — Cloudflare will re-trigger callback.
          // This fires only on permanent timeout.
        },
      });
    },
    [cleanupWidget, resolveRequest, rejectRequest]
  );

  // Called when the dialog animation finishes or opens.
  const value = useMemo<TurnstileContextValue>(
    () => ({ requestTurnstile }),
    [requestTurnstile]
  );

  return (
    <TurnstileContext.Provider value={value}>
      {children}
      <TurnstileDialogInner
        open={open}
        action={currentAction}
        onOpenChange={handleOpenChange}
        onWidgetReady={onWidgetReady}
        cleanupWidget={cleanupWidget}
      />
    </TurnstileContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Dialog inner component — renders the Managed Turnstile widget
// ---------------------------------------------------------------------------

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function TurnstileDialogInner({
  open,
  action,
  onOpenChange,
  onWidgetReady,
  cleanupWidget,
}: {
  open: boolean;
  action: TurnstileAction | null;
  onOpenChange: (open: boolean) => void;
  onWidgetReady: (container: HTMLDivElement) => void;
  cleanupWidget: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const readyRef = useRef(false);

  // When the dialog opens and the container is mounted, initialize the widget.
  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        containerRef.current = node;
        // Small delay to let dialog animation finish before rendering widget.
        requestAnimationFrame(() => {
          if (containerRef.current && !readyRef.current) {
            readyRef.current = true;
            onWidgetReady(containerRef.current);
          }
        });
      }
    },
    [onWidgetReady]
  );

  // Reset ready state when dialog closes.
  if (!open && readyRef.current) {
    readyRef.current = false;
  }

  const actionLabel: Record<TurnstileAction, string> = {
    signup: "Verify you are human",
    otp_resend: "Verify you are human",
    password_reset: "Verify you are human",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        showCloseButton={true}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Verification</DialogTitle>
          <DialogDescription>
            {action ? actionLabel[action] : "Verify you are human"}
          </DialogDescription>
        </DialogHeader>
        <div
          ref={handleRef}
          className="min-h-[65px]"
          aria-label="Human verification"
        />
      </DialogContent>
    </Dialog>
  );
}
