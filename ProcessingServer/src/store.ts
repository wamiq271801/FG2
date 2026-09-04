/**
 * Fusion Gadgets — ProcessingServer data access (TiDB + Supabase).
 *
 * The persistence layer of the processor, separated from the HTTP server so
 * the real production code path (batch reads, aggregation, durable metric
 * transactions, feed publication, notification) is directly testable.
 */

import { connect } from "@tidbcloud/serverless";
import { createClient } from "@supabase/supabase-js";
import {
  parseFeed,
  type CatalogRow,
  type HomeFeedSnapshot,
  type ProductDelta,
  type ProductMetric,
} from "./feed";

// TEST PROJECT KEYS — disposable (env vars override; same convention as the
// storefront's lib/supabase/config.ts hardcoded test defaults).
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://onyzjnitnekjhdexecdm.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXpqbml0bmVramhkZXhlY2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzAzNzY1NSwiZXhwIjoyMTAyNjEzNjU1fQ.XcDlBReiaBQRg7xcftYqu5wMFG9zQhPTYvetc6G4Exk";

// Storefront cache-invalidation notification (the domain event the
// storefront resolves to its feed:home cache tag). One attempt, 10s.
const STOREFRONT_REVALIDATE_URL =
  process.env.STOREFRONT_REVALIDATE_URL ??
  "http://127.0.0.1:3000/api/revalidate";
const STOREFRONT_REVALIDATE_SECRET =
  process.env.STOREFRONT_REVALIDATE_SECRET ?? "";

export const TIDB_DATABASE_URL =
  process.env.TIDB_DATABASE_URL ??
  (process.env.TIDB_HOST
    ? `mysql://${process.env.TIDB_USER}:${process.env.TIDB_PASSWORD}@${process.env.TIDB_HOST}:${process.env.TIDB_PORT ?? 4000}/${process.env.TIDB_DATABASE ?? "fusion_tracking"}?ssl={"minVersion":"TLSv1.2"}`
    : "");

export const STOREFRONT_NOTIFY_CONFIGURED = Boolean(STOREFRONT_REVALIDATE_SECRET);

let tidbConn: Awaited<ReturnType<typeof connect>> | null = null;

export async function getTiDB() {
  if (!TIDB_DATABASE_URL) return null;
  if (!tidbConn) tidbConn = connect({ url: TIDB_DATABASE_URL });
  return tidbConn;
}

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

// ── Processing lock ──
const LOCK_TTL_SECONDS = 120; // lock auto-expires after 2 minutes

export async function acquireLock(conn: Awaited<ReturnType<typeof connect>>): Promise<string | null> {
  const owner = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString().slice(0, 23).replace("T", " ");
  const expiry = new Date(Date.now() + LOCK_TTL_SECONDS * 1000).toISOString().slice(0, 23).replace("T", " ");

  // Try to acquire: only succeeds if no active lock (or expired lock)
  await conn.execute(
    `UPDATE processing_lock SET owner = ?, acquired_at = ?, expires_at = ? WHERE id = 1 AND (owner IS NULL OR expires_at < ?)`,
    [owner, now, expiry, now]
  );

  // Check if we got the lock. Note: the serverless driver's execute()
  // returns the rows array directly (arrayMode=false, fullResult=false).
  const rows = (await conn.execute(
    `SELECT owner FROM processing_lock WHERE id = 1`
  )) as unknown as { owner: string | null }[];
  if (rows.length > 0 && rows[0].owner === owner) {
    return owner;
  }
  return null;
}

export async function releaseLock(conn: Awaited<ReturnType<typeof connect>>, owner: string): Promise<void> {
  await conn.execute(
    `UPDATE processing_lock SET owner = NULL, acquired_at = NULL, expires_at = NULL WHERE id = 1 AND owner = ?`,
    [owner]
  );
}

// ── Checkpoint ──
export async function getCheckpoint(conn: Awaited<ReturnType<typeof connect>>): Promise<number> {
  const rows = (await conn.execute(
    `SELECT last_event_id FROM processing_checkpoint WHERE id = 1`
  )) as unknown as { last_event_id: number | string }[];
  return Number(rows[0]?.last_event_id ?? 0);
}

// ── Read bounded batch of new events (product_id-keyed) ──
export type RawEvent = {
  id: number;
  event_id: string;
  event_type: string;
  occurred_at: string;
  product_id: string | null;
  category_slug: string | null;
  surface: string | null;
  qty: number | null;
};

export async function readBatch(
  conn: Awaited<ReturnType<typeof connect>>,
  checkpoint: number,
  batchSize: number
): Promise<RawEvent[]> {
  const rows = (await conn.execute(
    `SELECT id, event_id, event_type, occurred_at, product_id, category_slug, surface, qty FROM raw_events WHERE id > ? ORDER BY id ASC LIMIT ?`,
    [checkpoint, batchSize]
  )) as unknown as RawEvent[];
  return rows ?? [];
}

// ── Aggregate the batch into per-product deltas ──
export function aggregate(events: RawEvent[]): Map<string, ProductDelta> {
  const deltas = new Map<string, ProductDelta>();

  for (const e of events) {
    if (!e.product_id) continue;
    const id = e.product_id;
    if (!deltas.has(id)) {
      deltas.set(id, { views: 0, impressions: 0, clicks: 0, cart_adds: 0, wishlist_adds: 0 });
    }
    const d = deltas.get(id)!;
    switch (e.event_type) {
      case "product_view": d.views++; break;
      case "product_impression": d.impressions++; break;
      case "product_click": d.clicks++; break;
      case "add_to_cart": d.cart_adds += e.qty ?? 1; break;
      case "wishlist_add": d.wishlist_adds++; break;
    }
  }

  return deltas;
}

// ── Durable cumulative state (TiDB product_metrics) ──
export async function readAllMetrics(conn: Awaited<ReturnType<typeof connect>>): Promise<ProductMetric[]> {
  const rows = (await conn.execute(
    `SELECT product_id, views, impressions, clicks, cart_adds, wishlist_adds FROM product_metrics`
  )) as unknown as ProductMetric[];
  return rows ?? [];
}

/**
 * Persist the batch's metric deltas AND advance the checkpoint in ONE
 * transaction — the durable "consume this batch" unit. If any part fails,
 * neither the metrics nor the checkpoint change, so the batch is safely
 * reprocessed on the next run (no double-counting, no lost events).
 */
export async function commitMetricsAndCheckpoint(
  conn: Awaited<ReturnType<typeof connect>>,
  deltas: Map<string, ProductDelta>,
  lastEventId: number
): Promise<void> {
  if (deltas.size === 0 && lastEventId < 0) return;
  const now = new Date().toISOString().slice(0, 23).replace("T", " ");

  const tx = await conn.begin();
  try {
    if (deltas.size > 0) {
      const rows = [...deltas.entries()];
      const placeholders = rows.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
      const args = rows.flatMap(([id, d]) => [
        id,
        d.views,
        d.impressions,
        d.clicks,
        d.cart_adds,
        d.wishlist_adds,
      ]);
      await tx.execute(
        `INSERT INTO product_metrics (product_id, views, impressions, clicks, cart_adds, wishlist_adds)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE
           views = views + VALUES(views),
           impressions = impressions + VALUES(impressions),
           clicks = clicks + VALUES(clicks),
           cart_adds = cart_adds + VALUES(cart_adds),
           wishlist_adds = wishlist_adds + VALUES(wishlist_adds)`,
        args
      );
    }
    await tx.execute(
      `UPDATE processing_checkpoint SET last_event_id = ?, updated_at = ? WHERE id = 1`,
      [lastEventId, now]
    );
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

// ── Supabase: catalog eligibility facts ──
export async function readCatalog(): Promise<CatalogRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id, is_active, stock, added_at, price, compare_at_price");
  if (error) throw new Error(`Failed to read products: ${error.message}`);
  return (data ?? []) as CatalogRow[];
}

// ── Supabase: the home_feed singleton ──
export async function readCurrentFeed(): Promise<HomeFeedSnapshot | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("home_feed")
    .select("feed")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    // The home_feed table not existing yet is a deployment state (the
    // migration has not been applied) — treat as "nothing published".
    if (error.code === "PGRST205") return null;
    throw new Error(`Failed to read home_feed: ${error.message}`);
  }
  if (!data) return null;
  return parseFeed((data as { feed: unknown }).feed);
}

export async function writeHomeFeed(feed: HomeFeedSnapshot): Promise<void> {
  const supabase = getSupabase() as unknown as {
    from: (table: string) => {
      upsert: (values: unknown, opts: { onConflict: string }) => Promise<{
        error: { message: string; code: string } | null;
      }>;
    };
  };
  const { error } = await supabase
    .from("home_feed")
    .upsert(
      { id: 1, feed, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) throw new Error(`Failed to publish home_feed: ${error.message}`);
}

// ── Storefront notification: the feed.published domain event ──
// One attempt, 10s timeout. The storefront owns event→tag resolution
// (feed.published → feed:home); this server never sends cache tags.
export type NotifyResult = { ok: true } | { ok: false; message: string };

export async function notifyStorefront(): Promise<NotifyResult> {
  if (!STOREFRONT_REVALIDATE_SECRET) {
    return { ok: false, message: "STOREFRONT_REVALIDATE_SECRET not configured" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(STOREFRONT_REVALIDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STOREFRONT_REVALIDATE_SECRET}`,
      },
      body: JSON.stringify({ type: "feed.published" }),
      signal: controller.signal,
    });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok && (body as { success?: boolean } | null)?.success === true) {
      return { ok: true };
    }
    return {
      ok: false,
      message: `storefront rejected the notification (HTTP ${res.status})`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return { ok: false, message: `notification failed: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}
