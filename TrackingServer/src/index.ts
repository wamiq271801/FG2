/**
 * Fusion Gadgets — TrackingServer (Render).
 *
 * Receives batched tracking events from the frontend, validates them, and
 * bulk-inserts into TiDB Cloud via the @tidbcloud/serverless HTTP driver.
 * Stateless, fast, no processing logic. Dedup via TiDB UNIQUE KEY on event_id.
 *
 * Endpoints:
 *   GET  /health
 *   POST /events  — validate + bulk insert into TiDB raw_events
 */

import { createServer, type IncomingMessage } from "node:http";
import { connect } from "@tidbcloud/serverless";

// TiDB Cloud connection (env vars — never shipped to browser)
const TIDB_DATABASE_URL =
  process.env.TIDB_DATABASE_URL ??
  // Fallback to individual env vars for local dev
  (process.env.TIDB_HOST
    ? `mysql://${process.env.TIDB_USER}:${process.env.TIDB_PASSWORD}@${process.env.TIDB_HOST}:${process.env.TIDB_PORT ?? 4000}/${process.env.TIDB_DATABASE ?? "fusion_tracking"}?ssl={"minVersion":"TLSv1.2"}`
    : "");

let conn: Awaited<ReturnType<typeof connect>> | null = null;

async function getConn() {
  if (!TIDB_DATABASE_URL) return null;
  if (!conn) {
    conn = connect({ url: TIDB_DATABASE_URL });
  }
  return conn;
}

const MAX_BATCH_SIZE = 50;
const MAX_EVENTS_PER_MINUTE = 200;
const rateBuckets = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - 60000;
  const arr = (rateBuckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= MAX_EVENTS_PER_MINUTE) {
    rateBuckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(ip, arr);
  return true;
}

function clientIp(headers: IncomingMessage["headers"]): string {
  const forwarded = headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0].trim();
  const cfIp = headers["cf-connecting-ip"];
  return (Array.isArray(cfIp) ? cfIp[0] : cfIp) ?? forwardedIp ?? "unknown";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const VALID_EVENT_TYPES = new Set([
  "product_view",
  "product_impression",
  "product_click",
  "add_to_cart",
  "remove_from_cart",
  "wishlist_add",
  "wishlist_remove",
  "category_view",
  "search",
]);

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type",
};

type JsonResponse = { status: number; headers: Record<string, string>; body: string };

const json = (body: unknown, status: number): JsonResponse => ({
  status,
  headers: { "content-type": "application/json", ...CORS_HEADERS },
  body: JSON.stringify(body),
});

function validateEvent(event: unknown): { ok: true; data: TrackingEventInput } | { ok: false; reason: string } {
  if (typeof event !== "object" || event === null) return { ok: false, reason: "not an object" };
  const e = event as Record<string, unknown>;
  const event_id = typeof e.event_id === "string" ? e.event_id : "";
  const event_type = typeof e.event_type === "string" ? e.event_type : "";
  const occurred_at = typeof e.occurred_at === "string" ? e.occurred_at : "";

  if (!event_id || event_id.length > 36) return { ok: false, reason: "invalid event_id" };
  if (!VALID_EVENT_TYPES.has(event_type)) return { ok: false, reason: `invalid event_type: ${event_type}` };

  const ts = new Date(occurred_at);
  if (isNaN(ts.getTime())) return { ok: false, reason: "invalid occurred_at" };
  const now = Date.now();
  if (ts.getTime() > now + 60000) return { ok: false, reason: "future timestamp" };
  if (ts.getTime() < now - 7 * 24 * 60 * 60 * 1000) return { ok: false, reason: "timestamp too old" };

  const product_slug = typeof e.product_slug === "string" ? e.product_slug.slice(0, 160) : null;
  const category_slug = typeof e.category_slug === "string" ? e.category_slug.slice(0, 160) : null;
  const surface = typeof e.surface === "string" ? e.surface.slice(0, 48) : null;
  const qty = typeof e.qty === "number" && e.qty > 0 ? Math.floor(e.qty) : null;

  return { ok: true, data: { event_id, event_type, occurred_at, product_slug, category_slug, surface, qty } };
}

type TrackingEventInput = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  product_slug: string | null;
  category_slug: string | null;
  surface: string | null;
  qty: number | null;
};

const port = Number(process.env.PORT ?? 3001);

async function handleEvents(req: IncomingMessage): Promise<JsonResponse> {
  const ip = clientIp(req.headers);
  if (!rateLimit(ip)) {
    return json({ error: "rate_limited" }, 429);
  }

  let body: unknown;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (typeof body !== "object" || body === null || !Array.isArray((body as { events?: unknown }).events)) {
    return json({ error: "invalid_body" }, 400);
  }

  const rawEvents = (body as { events: unknown[] }).events;
  if (rawEvents.length === 0) {
    return json({ ok: true, stored: 0 }, 200);
  }
  if (rawEvents.length > MAX_BATCH_SIZE) {
    return json({ error: "batch_too_large", max: MAX_BATCH_SIZE }, 422);
  }

  // Validate all events
  const validated: TrackingEventInput[] = [];
  for (const raw of rawEvents) {
    const result = validateEvent(raw);
    if (result.ok) validated.push(result.data);
  }

  if (validated.length === 0) {
    return json({ error: "no_valid_events" }, 422);
  }

  // Bulk insert into TiDB — dedup via UNIQUE KEY on event_id
  const conn = await getConn();
  if (!conn) {
    // No TiDB connection configured — accept but don't store
    return json({ ok: true, stored: 0, warning: "no_tidb" }, 200);
  }

  try {
    const receivedAt = new Date().toISOString().slice(0, 23).replace("T", " ");
    const values = validated
      .map(
        (e) =>
          `(${JSON.stringify(e.event_id)}, ${JSON.stringify(e.event_type)}, ${JSON.stringify(e.occurred_at.slice(0, 23).replace("T", " "))}, ${JSON.stringify(receivedAt)}, ${e.product_slug ? JSON.stringify(e.product_slug) : "NULL"}, ${e.category_slug ? JSON.stringify(e.category_slug) : "NULL"}, NULL, ${e.surface ? JSON.stringify(e.surface) : "NULL"}, ${e.qty ?? "NULL"})`
      )
      .join(", ");

    await conn.execute(
      `INSERT IGNORE INTO raw_events (event_id, event_type, occurred_at, received_at, product_slug, category_slug, session_id, surface, qty) VALUES ${values}`
    );

    return json({ ok: true, stored: validated.length }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return json({ error: "storage_failed", detail: msg.slice(0, 200) }, 500);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if (url.pathname === "/events" && req.method === "POST") {
    const result = await handleEvents(req);
    res.writeHead(result.status, result.headers);
    res.end(result.body);
    return;
  }

  const notFound = json({ error: "not_found" }, 404);
  res.writeHead(notFound.status, notFound.headers);
  res.end(notFound.body);
});

server.listen(port, () => {
  console.log(`TrackingServer listening on :${port}`);
});
