-- ============================================================
-- Fusion Gadgets — TiDB schema for raw tracking events.
-- MySQL dialect (TiDB is MySQL-compatible). Run on TiDB Cloud / a TiDB instance.
--
-- This is the RAW event store ONLY. It never holds business data and never holds
-- processed/circulation output (that lives in Supabase). The processing state
-- (checkpoint + lock) also lives here so the processor's coordination state is
-- co-located with the data it tracks and does not depend on Render local storage.
--
-- Flow (future phases):
--   Browser -> TrackingServer (batch ingest) -> raw_events (here)
--   ProcessingServer (cron) -> read after checkpoint -> aggregate -> publish to Supabase
-- ============================================================

-- --------------------------------------------------------------------------
-- raw_events: append-only, ordered, deduplicable.
-- `id` is the monotonic processing key (TiDB AUTO_INCREMENT is monotonic per
--   instance, which is sufficient for ordered single-instance processing).
-- `event_id` is the client-generated unique id used for idempotent dedup on insert.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_events (
  id              BIGINT NOT NULL AUTO_INCREMENT,
  event_id        CHAR(36)  NOT NULL,             -- client uuid; dedup key
  event_type      VARCHAR(48) NOT NULL,           -- e.g. "product_view","add_to_cart"
  occurred_at     DATETIME(3) NOT NULL,           -- when it happened on the client
  received_at     DATETIME(3) NOT NULL,           -- when TrackingServer got it
  product_slug    VARCHAR(160) NULL,               -- NULL if event is not product-scoped
  category_slug   VARCHAR(160) NULL,
  session_id      CHAR(36) NULL,                   -- anonymous session id (no PII)
  surface         VARCHAR(48) NULL,               -- e.g. "home","shop","product"
  qty             INT NULL,                        -- for add_to_cart/purchase events
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_id (event_id),
  KEY idx_raw_events_received (received_at),
  KEY idx_raw_events_product (product_slug, occurred_at),
  KEY idx_raw_events_type_time (event_type, occurred_at)
) ENGINE = TiDB;

-- Retention: raw events are not kept forever. A scheduled job (later phase) trims
-- rows older than the retention window once they have been processed + aggregated.
-- (Implemented later; no automation in Phase 1.)

-- --------------------------------------------------------------------------
-- processing_checkpoint: the last raw_events.id the processor has fully
-- consumed + persisted results for. The processor advances this ONLY after a
-- successful publish to Supabase. A single row, pinned at id=1.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processing_checkpoint (
  id            TINYINT NOT NULL DEFAULT 1,
  last_event_id BIGINT NOT NULL DEFAULT 0,
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT chk_checkpoint_singleton CHECK (id = 1)
);

INSERT INTO processing_checkpoint (id, last_event_id) VALUES (1, 0)
  ON DUPLICATE KEY UPDATE id = id;

-- --------------------------------------------------------------------------
-- processing_lock: prevents overlapping processor runs (e.g. overlapping cron
-- triggers) from processing the same event range. Recoverable after crashes:
-- `expires_at` lets a stale lock be reclaimed once it is past expiry.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processing_lock (
  id            TINYINT NOT NULL DEFAULT 1,
  owner         VARCHAR(64) NULL,                 -- processor run identifier
  acquired_at   DATETIME(3) NULL,
  expires_at    DATETIME(3) NULL,                 -- when a crashed owner's lock is reclaimable
  PRIMARY KEY (id),
  CONSTRAINT chk_lock_singleton CHECK (id = 1)
);

-- --------------------------------------------------------------------------
-- RETENTION: raw events are retained for 30 days after processing. Events
-- older than the retention window AND already processed (id <= checkpoint)
-- can be safely deleted. This is run periodically (not in Phase 7 scope
-- beyond the schema boundary). The checkpoint is always preserved.
--
-- Safe retention query (run manually or via cron later):
--   DELETE FROM raw_events
--   WHERE id <= (SELECT last_event_id FROM processing_checkpoint WHERE id = 1)
--     AND occurred_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
--   LIMIT 10000;
-- --------------------------------------------------------------------------
