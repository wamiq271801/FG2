/**
 * Fusion Gadgets — ProcessingServer (Render, cron-triggered).
 *
 * Reads raw tracking events from TiDB after the processing checkpoint,
 * aggregates product-level metrics, writes ready circulation data to Supabase,
 * and advances the checkpoint only after successful persistence.
 *
 * Endpoints:
 *   GET  /health
 *   POST /process  — acquire lock + read checkpoint + bounded batch + aggregate + publish + advance
 *
 * Safety:
 * - Processing lock (TiDB processing_lock table) prevents overlapping cron runs
 * - Lock has expiry (recovers from crash)
 * - Checkpoint advances only after Supabase write succeeds
 * - Idempotent: reprocessing the same events produces the same aggregate
 * - Bounded batch size (PROCESSOR_BATCH_SIZE) prevents memory exhaustion
 */

import { createServer, type IncomingMessage } from "node:http";
import { connect } from "@tidbcloud/serverless";
import { createClient } from "@supabase/supabase-js";

// TEST PROJECT KEYS — disposable.
const SUPABASE_URL = "https://onyzjnitnekjhdexecdm.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXpqbml0bmVramhkZXhlY2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzAzNzY1NSwiZXhwIjoyMTAyNjEzNjU1fQ.XcDlBReiaBQRg7xcftYqu5wMFG9zQhPTYvetc6G4Exk";

const PROCESSOR_CRON_SECRET = process.env.PROCESSOR_CRON_SECRET ?? "dev-cron-secret";
const TIDB_DATABASE_URL =
  process.env.TIDB_DATABASE_URL ??
  (process.env.TIDB_HOST
    ? `mysql://${process.env.TIDB_USER}:${process.env.TIDB_PASSWORD}@${process.env.TIDB_HOST}:${process.env.TIDB_PORT ?? 4000}/${process.env.TIDB_DATABASE ?? "fusion_tracking"}?ssl={"minVersion":"TLSv1.2"}`
    : "");
const BATCH_SIZE = Number(process.env.PROCESSOR_BATCH_SIZE ?? 1000);
const LOCK_TTL_SECONDS = 120; // lock auto-expires after 2 minutes

let tidbConn: Awaited<ReturnType<typeof connect>> | null = null;

async function getTiDB() {
  if (!TIDB_DATABASE_URL) return null;
  if (!tidbConn) tidbConn = connect({ url: TIDB_DATABASE_URL });
  return tidbConn;
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type JsonResponse = { status: number; headers: Record<string, string>; body: string };

const json = (body: unknown, status: number): JsonResponse => ({
  status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ── Processing lock ──
async function acquireLock(conn: Awaited<ReturnType<typeof connect>>): Promise<string | null> {
  const owner = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString().slice(0, 23).replace("T", " ");
  const expiry = new Date(Date.now() + LOCK_TTL_SECONDS * 1000).toISOString().slice(0, 23).replace("T", " ");

  // Try to acquire: only succeeds if no active lock (or expired lock)
  const result = await conn.execute(
    `UPDATE processing_lock SET owner = ?, acquired_at = ?, expires_at = ? WHERE id = 1 AND (owner IS NULL OR expires_at < ?)`,
    [owner, now, expiry, now]
  );

  // Check if we got the lock
  const check = await conn.execute(`SELECT owner FROM processing_lock WHERE id = 1`);
  const rows = check.rows as { owner: string | null }[];
  if (rows.length > 0 && rows[0].owner === owner) {
    return owner;
  }
  return null;
}

async function releaseLock(conn: Awaited<ReturnType<typeof connect>>, owner: string): Promise<void> {
  await conn.execute(
    `UPDATE processing_lock SET owner = NULL, acquired_at = NULL, expires_at = NULL WHERE id = 1 AND owner = ?`,
    [owner]
  );
}

// ── Checkpoint ──
async function getCheckpoint(conn: Awaited<ReturnType<typeof connect>>): Promise<number> {
  const result = await conn.execute(`SELECT last_event_id FROM processing_checkpoint WHERE id = 1`);
  const rows = result.rows as { last_event_id: number }[];
  return rows[0]?.last_event_id ?? 0;
}

async function advanceCheckpoint(conn: Awaited<ReturnType<typeof connect>>, eventId: number): Promise<void> {
  const now = new Date().toISOString().slice(0, 23).replace("T", " ");
  await conn.execute(
    `UPDATE processing_checkpoint SET last_event_id = ?, updated_at = ? WHERE id = 1`,
    [eventId, now]
  );
}

// ── Read bounded batch of new events ──
type RawEvent = {
  id: number;
  event_id: string;
  event_type: string;
  occurred_at: string;
  product_slug: string | null;
  category_slug: string | null;
  surface: string | null;
  qty: number | null;
};

async function readBatch(conn: Awaited<ReturnType<typeof connect>>, checkpoint: number): Promise<RawEvent[]> {
  const result = await conn.execute(
    `SELECT id, event_id, event_type, occurred_at, product_slug, category_slug, surface, qty FROM raw_events WHERE id > ? ORDER BY id ASC LIMIT ?`,
    [checkpoint, BATCH_SIZE]
  );
  return (result.rows ?? []) as RawEvent[];
}

// ── Aggregate events into product-level metrics ──
type ProductMetric = {
  product_slug: string;
  views: number;
  impressions: number;
  clicks: number;
  cart_adds: number;
  wishlist_adds: number;
  score: number;
};

function aggregate(events: RawEvent[]): Map<string, ProductMetric> {
  const metrics = new Map<string, ProductMetric>();

  for (const e of events) {
    if (!e.product_slug) continue;
    const slug = e.product_slug;
    if (!metrics.has(slug)) {
      metrics.set(slug, { product_slug: slug, views: 0, impressions: 0, clicks: 0, cart_adds: 0, wishlist_adds: 0, score: 0 });
    }
    const m = metrics.get(slug)!;
    switch (e.event_type) {
      case "product_view": m.views++; break;
      case "product_impression": m.impressions++; break;
      case "product_click": m.clicks++; break;
      case "add_to_cart": m.cart_adds += e.qty ?? 1; break;
      case "wishlist_add": m.wishlist_adds++; break;
    }
  }

  // Compute a simple score: weighted sum of interactions
  for (const m of metrics.values()) {
    m.score = m.views * 1 + m.clicks * 3 + m.cart_adds * 5 + m.wishlist_adds * 2;
  }

  return metrics;
}

// ── Publish to Supabase circulation tables ──
async function publishToSupabase(metrics: Map<string, ProductMetric>): Promise<void> {
  if (metrics.size === 0) return;
  const supabase = getSupabase();

  // Create a new circulation version (status='building')
  const { data: versionData, error: versionError } = await supabase
    .from("circulation_versions")
    .insert({ version: Date.now(), status: "building" })
    .select("id")
    .single();

  if (versionError || !versionData) throw new Error(`Failed to create circulation version: ${versionError?.message ?? "unknown"}`);
  const versionId = (versionData as { id: number }).id;

  // Build circulation entries for home_trending surface (sorted by score desc)
  const sorted = [...metrics.values()].sort((a, b) => b.score - a.score);
  const trendingEntries = sorted.slice(0, 6).map((m, i) => ({
    version_id: versionId,
    surface: "home_trending" as const,
    product_slug: m.product_slug,
    position: i,
    score: m.score,
  }));

  if (trendingEntries.length > 0) {
    const { error: entriesError } = await supabase
      .from("circulation_entries")
      .insert(trendingEntries);
    if (entriesError) throw new Error(`Failed to insert circulation entries: ${entriesError.message}`);
  }

  // Publish the version (flip status to 'published' — archive previous via unique index)
  // First, archive the current published version
  await supabase
    .from("circulation_versions")
    .update({ status: "archived" })
    .eq("status", "published");

  const { error: publishError } = await supabase
    .from("circulation_versions")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", versionId);

  if (publishError) throw new Error(`Failed to publish circulation version: ${publishError.message}`);
}

// ── Main processing handler ──
async function handleProcess(req: IncomingMessage): Promise<JsonResponse> {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const secret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (secret !== PROCESSOR_CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const conn = await getTiDB();
  if (!conn) {
    return json({ ok: true, skipped: "no_tidb" }, 200);
  }

  // Acquire lock
  const owner = await acquireLock(conn);
  if (!owner) {
    return json({ ok: true, skipped: "locked" }, 200);
  }

  try {
    const checkpoint = await getCheckpoint(conn);
    const batch = await readBatch(conn, checkpoint);

    if (batch.length === 0) {
      await releaseLock(conn, owner);
      return json({ ok: true, processed: 0, checkpoint }, 200);
    }

    // Aggregate
    const metrics = aggregate(batch);

    // Publish to Supabase (only if we have product-scoped events)
    if (metrics.size > 0) {
      await publishToSupabase(metrics);
    }

    // Advance checkpoint to the last event ID in this batch
    const lastEventId = batch[batch.length - 1].id;
    await advanceCheckpoint(conn, lastEventId);

    await releaseLock(conn, owner);
    return json({ ok: true, processed: batch.length, checkpoint: lastEventId, products: metrics.size }, 200);
  } catch (err) {
    // Don't release lock on error — let it expire naturally to prevent
    // immediate re-processing of the same failed batch
    const msg = err instanceof Error ? err.message : "unknown";
    return json({ error: "processing_failed", detail: msg.slice(0, 200) }, 500);
  }
}

const port = Number(process.env.PORT ?? 3002);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if (url.pathname === "/process" && req.method === "POST") {
    const result = await handleProcess(req);
    res.writeHead(result.status, result.headers);
    res.end(result.body);
    return;
  }

  const notFound = json({ error: "not_found" }, 404);
  res.writeHead(notFound.status, notFound.headers);
  res.end(notFound.body);
});

server.listen(port, () => {
  console.log(`ProcessingServer listening on :${port}`);
});
