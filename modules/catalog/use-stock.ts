"use client";

/**
 * useStock — the hydration-time availability refresh (client boundary).
 *
 * After hydration the product page re-fetches ONLY
 * { stock, isActive, isPreorder, availability } for the product ids it
 * cares about (the product + its variation siblings). All consumers on a
 * page share ONE batched request: ids are queued within a tick and flushed
 * as a single GET /api/stock?ids=…, with in-flight de-duplication across
 * every mounted consumer.
 *
 * Exactly ONE refresh per id — there is no polling. A failed fetch keeps
 * the server-rendered values (the id resolves to null and is never
 * retried).
 */

import { useEffect, useSyncExternalStore } from "react";
import type { StockInfo } from "@/types";

// id → resolved StockInfo, or null when the id is known to have no live
// resolution (fetch failed or product absent).
const resolved = new Map<string, StockInfo | null>();
// ids scheduled for the next (single) flush.
const queued = new Set<string>();
// ids currently on the wire.
let inflight: Set<string> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
// Bumped on every resolution batch — the external-store snapshot.
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  for (const listener of listeners) listener();
}

function flush() {
  flushTimer = null;
  const ids = [...queued];
  queued.clear();
  if (ids.length === 0) return;
  inflight = new Set(ids);

  fetch(`/api/stock?ids=${ids.join(",")}`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`stock fetch failed: ${res.status}`);
      return (await res.json()) as { stocks?: Record<string, StockInfo> };
    })
    .then((data) => {
      for (const [id, info] of Object.entries(data.stocks ?? {})) {
        resolved.set(id, info);
      }
    })
    .catch(() => {
      // Keep the server-rendered values for every id in this batch.
    })
    .finally(() => {
      inflight = null;
      for (const id of ids) {
        if (!resolved.has(id)) resolved.set(id, null);
      }
      notify();
    });
}

function schedule(ids: string[]) {
  for (const id of ids) {
    if (resolved.has(id) || inflight?.has(id) || queued.has(id)) continue;
    queued.add(id);
  }
  if (queued.size > 0 && flushTimer === null) {
    flushTimer = setTimeout(flush, 0);
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * Live stock for the given product ids.
 *
 * Returns a plain record `id → StockInfo | null`. Before the single fetch
 * resolves every entry is null — consumers fall back to their
 * server-rendered initial values in that case (and permanently on
 * failure).
 */
export function useStock(ids: string[]): Record<string, StockInfo | null> {
  const key = ids.join(",");
  // Re-renders exactly when a resolution batch lands.
  const versionSnapshot = useSyncExternalStore(
    subscribe,
    () => version,
    () => version
  );
  void versionSnapshot;

  useEffect(() => {
    if (key) schedule(key.split(","));
  }, [key]);

  const map: Record<string, StockInfo | null> = {};
  for (const id of ids) map[id] = resolved.get(id) ?? null;
  return map;
}
