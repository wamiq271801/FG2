-- ============================================================
-- Home feed — single global snapshot table (home_feed)
-- ============================================================
--
-- Purpose
--   Create the ONE homepage-feed storage model: a singleton row in
--   `home_feed` holding the current global feed snapshot as JSONB.
--
--   The ProcessingServer generates the complete feed in memory
--   (most_popular / new_arrivals / explore_more / on_sale, each an
--   ordered array of product UUIDs) and upserts the singleton after
--   validation. The Main Website reads the same row server-side via
--   getHomeFeed().
--
-- Shape (feed JSONB)
--   {
--     "most_popular": ["<product-uuid>", ...],   -- display order
--     "new_arrivals":  [...],
--     "explore_more":  [...],
--     "on_sale":       [...]
--   }
--   Product UUIDs ONLY — no slug, no price, no images, no stock, no
--   product snapshot, no scores. The products table remains the source
--   of truth for what those products currently are.
--
-- What this REPLACES (and why it does not exist here)
--   The old circulation feed system (circulation_entries +
--   circulation_versions, per-surface editorial/rotation fallbacks) is
--   dead: no compatibility tables are created, no fallback path exists.
--   A missing/empty feed is a valid pipeline state — the homepage
--   simply renders without product-feed sections.
--
-- Access
--   anon            SELECT only (the storefront's public catalog reads).
--   service_role    full DML (the ProcessingServer's publication path;
--                   no RLS policy permits any client write).
--
-- Idempotency
--   Guarded with IF NOT EXISTS + ON CONFLICT so the file re-applies
--   cleanly. Apply as a single script (Supabase SQL Editor or MCP).

-- ─── Step 1: table ───────────────────────────────────────────
--
-- Singleton row pinned at id = 1 (same pattern as the TiDB
-- processing_checkpoint / processing_lock coordination rows).

CREATE TABLE IF NOT EXISTS public.home_feed (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  feed        jsonb   NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.home_feed IS
  'Current global homepage feed snapshot (single row, id=1): four ordered product-UUID arrays. Written by the ProcessingServer, read by the storefront.';
COMMENT ON COLUMN public.home_feed.feed IS
  '{"most_popular":[],"new_arrivals":[],"explore_more":[],"on_sale":[]} — product UUIDs in display order, nothing else.';

-- ─── Step 2: the singleton row ───────────────────────────────
--
-- Starts as the valid empty feed. The first ProcessingServer run
-- replaces it with a real selection.

INSERT INTO public.home_feed (id, feed, updated_at)
VALUES (1, '{"most_popular":[],"new_arrivals":[],"explore_more":[],"on_sale":[]}'::jsonb, now())
ON CONFLICT (id) DO NOTHING;

-- ─── Step 3: RLS ─────────────────────────────────────────────
--
-- Public read of the CURRENT snapshot; writes are service-role only
-- (no policy grants any update to anon/authenticated).

ALTER TABLE public.home_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS home_feed_public_read ON public.home_feed;
CREATE POLICY home_feed_public_read
  ON public.home_feed
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─── Step 4: grants ──────────────────────────────────────────
--
-- anon/authenticated: SELECT (also the default public schema grant, but
-- explicit here so the boundary is documented). service_role: full DML
-- for the processor's upsert.

GRANT SELECT ON public.home_feed TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_feed TO service_role;
