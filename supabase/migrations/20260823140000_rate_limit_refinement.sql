-- ============================================================
-- Rate-limit refinement: password-reset cooldown + concurrency fix
-- ============================================================
--
-- 1. Clean up obsolete password_reset_cooldown rows from worker_rate_limits
-- 2. Create dedicated password_reset_cooldowns table
-- 3. Create cooldown check/record functions
-- 4. Fix concurrency in check_rate_limit using pg_advisory_xact_lock
-- 5. Grant permissions

-- ─── Step 1: Clean up obsolete cooldown rows ──────────────────
--
-- The old implementation used worker_rate_limits with action='password_reset_cooldown'
-- and max=0, which broke on the first request. These rows are NOT valid cooldown
-- markers — they were created by a broken implementation and must be removed.

DELETE FROM public.worker_rate_limits
WHERE action = 'password_reset_cooldown';

-- ─── Step 2: Create dedicated cooldown table ──────────────────
--
-- A simple, explicit table for password-reset success cooldowns.
-- email_hash is HMAC-SHA256 (same model as worker_rate_limits).
-- UNIQUE constraint prevents duplicate active cooldowns.

CREATE TABLE IF NOT EXISTS public.password_reset_cooldowns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash  text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_password_reset_cooldowns_created_at
  ON public.password_reset_cooldowns (created_at);

-- ─── Step 3: Cooldown functions ───────────────────────────────
--
-- check_password_reset_cooldown: READ-ONLY check
--   Returns true if NO active cooldown exists (allowed to proceed).
--   Returns false if a cooldown is active (blocked).
--   Also cleans up expired cooldowns as a side effect.

CREATE OR REPLACE FUNCTION public.check_password_reset_cooldown(
  p_email_hash text,
  p_window_seconds integer DEFAULT 86400
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Clean up expired cooldowns for this email
  DELETE FROM public.password_reset_cooldowns
  WHERE email_hash = p_email_hash
    AND created_at < now() - make_interval(secs => p_window_seconds);

  -- Check if an active cooldown exists
  RETURN NOT EXISTS (
    SELECT 1 FROM public.password_reset_cooldowns
    WHERE email_hash = p_email_hash
  );
END;
$$;

-- record_password_reset_cooldown: INSERT cooldown after acknowledged recovery
--   Uses INSERT ... ON CONFLICT DO UPDATE to handle concurrent requests atomically.
--   Only one active cooldown can exist per email.

CREATE OR REPLACE FUNCTION public.record_password_reset_cooldown(
  p_email_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.password_reset_cooldowns (email_hash)
  VALUES (p_email_hash)
  ON CONFLICT (email_hash) DO UPDATE
    SET created_at = now();
END;
$$;

-- ─── Step 4: Fix concurrency in check_rate_limit ──────────────
--
-- Add pg_advisory_xact_lock to serialize concurrent requests for the same key.
-- This prevents two concurrent requests from both passing a strict limit.
-- The lock is based on a hash of (action, dimension, subject_hash).

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_dimension rate_limit_dimension_enum,
  p_subject_hash text,
  p_max integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
  v_lock_key bigint;
BEGIN
  IF p_action = '' OR p_subject_hash = '' OR p_max < 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'invalid rate-limit request' USING ERRCODE = 'check_violation';
  END IF;

  -- Serialize concurrent requests for the same logical key using advisory lock.
  -- Hash the key components into a single bigint for the lock.
  v_lock_key := hashtext(p_action || ':' || p_dimension::text || ':' || p_subject_hash);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  DELETE FROM worker_rate_limits
  WHERE action = p_action AND dimension = p_dimension AND subject_hash = p_subject_hash
    AND created_at < now() - make_interval(secs => p_window_seconds);

  INSERT INTO worker_rate_limits (action, dimension, subject_hash)
  VALUES (p_action, p_dimension, p_subject_hash);

  SELECT count(*) INTO v_count FROM worker_rate_limits
  WHERE action = p_action AND dimension = p_dimension AND subject_hash = p_subject_hash
    AND created_at >= now() - make_interval(secs => p_window_seconds);

  RETURN v_count <= p_max;
END;
$$;

-- ─── Step 5: Grants ───────────────────────────────────────────
--
-- Ensure service_role can execute the new functions.
-- The check_rate_limit function already has the correct permissions.

GRANT EXECUTE ON FUNCTION public.check_password_reset_cooldown(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_password_reset_cooldown(text) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_cooldowns TO service_role;

NOTIFY pgrst, 'reload schema';
