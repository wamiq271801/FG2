"use client";

import { useEffect, useRef, useState } from "react";

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
          appearance?: "always" | "execute" | "interaction-only";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstileLoad";
const ACTION = "signup";

let scriptLoading: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<void>((resolve) => {
    const prev = (window as unknown as { __onTurnstileLoad?: () => void }).__onTurnstileLoad;
    (window as unknown as { __onTurnstileLoad?: () => void }).__onTurnstileLoad = () => {
      prev?.();
      resolve();
    };
    const existing = document.querySelector(`script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]`);
    if (existing) return;
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export type TurnstileState = "idle" | "loading" | "success" | "expired" | "error";

export function TurnstileWidget({
  siteKey,
  onToken,
  onStateChange,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  onStateChange?: (state: TurnstileState) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [state, setState] = useState<TurnstileState>("idle");

  useEffect(() => {
    let cancelled = false;
    if (!siteKey || !containerRef.current) return;

    setState("loading");
    onStateChange?.("loading");

    loadTurnstileScript().then(() => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      // Clear any previous widget before rendering a new one.
      if (widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: ACTION,
        theme: "light",
        size: "normal",
        appearance: "always",
        callback: (token: string) => {
          if (cancelled) return;
          setState("success");
          onStateChange?.("success");
          onToken(token);
        },
        "expired-callback": () => {
          if (cancelled) return;
          setState("expired");
          onStateChange?.("expired");
          onToken(null);
        },
        "error-callback": () => {
          if (cancelled) return;
          setState("error");
          onStateChange?.("error");
          onToken(null);
        },
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
    // Re-run only when the site key changes.
  }, [siteKey]);

  const reset = () => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      setState("loading");
      onStateChange?.("loading");
      onToken(null);
    }
  };

  return (
    <div>
      <div ref={containerRef} className="min-h-[65px]" aria-label="Human verification" />
      {state === "expired" && (
        <button
          type="button"
          onClick={reset}
          className="text-xs text-copper hover:underline"
        >
          Verification expired. Click to retry.
        </button>
      )}
      {state === "error" && (
        <p className="text-xs text-destructive">
          Verification failed.{" "}
          <button type="button" onClick={reset} className="text-copper hover:underline">
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
