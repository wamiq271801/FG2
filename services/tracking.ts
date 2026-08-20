"use client";

/**
 * Frontend tracking — lightweight, batched, best-effort.
 *
 * Events enter an in-memory queue and are flushed to the TrackingServer in
 * batches (max 20 events or every 10s). Retries with exponential backoff.
 * Never blocks navigation or shows errors to the user.
 *
 * The TrackingServer is reached directly via NEXT_PUBLIC_TRACKING_URL.
 * No Supabase tokens, no Worker, no raw event storage in Supabase.
 */

type TrackingEvent = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  product_slug?: string;
  category_slug?: string;
  surface?: string;
  qty?: number;
};

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10000;
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const TRACKING_URL = `${process.env.NEXT_PUBLIC_TRACKING_URL ?? "http://localhost:3001"}/events`;

let queue: TrackingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof window === "undefined") return "server";
  const key = "fusion-session-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  sessionId = id;
  return id;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function track(eventType: string, data: Partial<Omit<TrackingEvent, "event_id" | "event_type" | "occurred_at">> = {}) {
  if (typeof window === "undefined") return;
  const event: TrackingEvent = {
    event_id: uuid(),
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    ...data,
  };
  queue.push(event);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(-MAX_QUEUE_SIZE);
  }
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush().catch(() => {});
  }, FLUSH_INTERVAL_MS);
}

async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.slice(0, BATCH_SIZE);
  try {
    const res = await fetch(TRACKING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (res.ok) {
      queue = queue.slice(batch.length);
    }
  } catch {
    // Network error — keep events for retry on next flush
  } finally {
    flushing = false;
  }
  if (queue.length >= BATCH_SIZE) {
    flush().catch(() => {});
  }
}

// Flush on page visibility change (tab switch / minimize)
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush().catch(() => {});
    }
  });
  // Flush on page unload
  window.addEventListener("pagehide", () => {
    flush().catch(() => {});
  });
}

// Public API
export function trackProductView(productSlug: string) {
  track("product_view", { product_slug: productSlug, surface: "product" });
}

export function trackProductImpression(productSlug: string, surface: string) {
  track("product_impression", { product_slug: productSlug, surface });
}

export function trackProductClick(productSlug: string, surface: string) {
  track("product_click", { product_slug: productSlug, surface });
}

export function trackAddToCart(productSlug: string, qty: number = 1) {
  track("add_to_cart", { product_slug: productSlug, qty, surface: "product" });
}

export function trackWishlistAdd(productSlug: string) {
  track("wishlist_add", { product_slug: productSlug });
}

export function trackCategoryView(categorySlug: string) {
  track("category_view", { category_slug: categorySlug, surface: "category" });
}

export function trackSearch(query: string) {
  track("search", { surface: "search", product_slug: query.slice(0, 160) });
}

// For testing/debugging
export function flushTracking() {
  return flush();
}
