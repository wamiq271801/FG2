-- Phase: Signup Authorization Gate
-- Worker-issued one-time registration authorizations, consumed atomically by the
-- Supabase "Before User Created" hook. Run in the Supabase Dashboard SQL Editor.
--
-- Flow:
--   Worker /auth/register  →  INSERT signup_authorizations (token_hash, email_hash, expires_at)
--                          →  POST /auth/v1/signup (server-to-server, anon key)
--                             with data.reg_auth = raw token in user_metadata
--                          →  Before User Created hook fires
--                             →  consume_signup_authorization(email_hash, token_hash)  [atomic UPDATE … RETURNING]
--   success / no row       →  allow / reject

-- pgcrypto provides digest() for SHA-256 hashing (Supabase ships it; enable explicitly).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- 1. signup_authorizations table
-- =========================================================================
CREATE TABLE IF NOT EXISTS signup_authorizations (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_hash   text NOT NULL,
  email_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Single-use: at most one unconsumed row per (token_hash, email_hash) may match.
-- A token already consumed cannot match the WHERE clause below, so reuse fails.
CREATE UNIQUE INDEX IF NOT EXISTS ux_signup_auth_token_hash_unconsumed
  ON signup_authorizations (token_hash)
  WHERE consumed_at IS NULL;

-- Lookup by (token_hash, email_hash) for the hook consume.
CREATE INDEX IF NOT EXISTS idx_signup_auth_token_email
  ON signup_authorizations (token_hash, email_hash);

-- Housekeeping aid (swept by service_role; not required for correctness).
CREATE INDEX IF NOT EXISTS idx_signup_auth_expires_at
  ON signup_authorizations (expires_at);

-- =========================================================================
-- 2. RLS — browser has NO access. Only the service_role (Worker INSERTs) and
--    the SECURITY DEFINER consume function (called by the auth hook) can touch
--    this table. anon/authenticated/public get nothing.
-- =========================================================================
ALTER TABLE signup_authorizations ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies => denied to anon/authenticated/public.
-- service_role bypasses RLS (used by the Worker to INSERT new authorizations).

-- =========================================================================
-- 3. Atomic consume function — the single authoritative authorization check.
--    Called by the Before User Created hook.
--
--    A single UPDATE ... RETURNING is atomic in Postgres: the row-level lock
--    acquired during the UPDATE means concurrent callers cannot both match the
--    same unconsumed row. The first commits consumed_at; the second's WHERE no
--    longer matches.
-- =========================================================================
CREATE OR REPLACE FUNCTION consume_signup_authorization(
  p_email_hash text,
  p_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row signup_authorizations;
BEGIN
  UPDATE signup_authorizations
     SET consumed_at = now()
   WHERE token_hash = p_token_hash
     AND email_hash = p_email_hash
     AND expires_at > now()
     AND consumed_at IS NULL
  RETURNING * INTO v_row;

  RETURN v_row.id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION consume_signup_authorization(text, text) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION consume_signup_authorization(text, text) FROM anon, authenticated, public;

-- =========================================================================
-- 4. Before User Created hook (Postgres function variant).
--
--    Supabase Auth invokes: hook_fn(event jsonb) returns jsonb
--      event.user.email           — the email being signed up
--      event.user.user_metadata   — the opaque 'reg_auth' credential
--
--    Returns '{}'::jsonb to allow; returns {"error":{...}} to reject.
--    Execute granted ONLY to supabase_auth_admin.
--
--    NOTE: pgcrypto is installed in the `extensions` schema on Supabase, not
--    `public`. Use extensions.digest(...) explicitly — do not use public.digest.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.hook_validate_signup_authorization(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email      text;
  v_token      text;
  v_email_hash text;
  v_token_hash text;
  v_algo       text := 'sha256';
  v_ok         boolean;
BEGIN
  v_email := event->'user'->>'email';
  v_token := event->'user'->'user_metadata'->>'reg_auth';

  -- No credential or no email → reject.
  IF v_email IS NULL OR v_token IS NULL OR v_email = '' OR v_token = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Signup is not authorized.'
      )
    );
  END IF;

  -- Normalize email identically to the Worker: lower(trim(email)) → SHA-256 → hex.
  -- pgcrypto is installed in the extensions schema on Supabase; qualify explicitly.
  v_email_hash := encode(extensions.digest(lower(trim(v_email)), v_algo), 'hex');
  v_token_hash := encode(extensions.digest(v_token, v_algo), 'hex');

  -- Single atomic consume.
  SELECT consume_signup_authorization(v_email_hash, v_token_hash) INTO v_ok;

  IF v_ok THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Your registration session expired. Please submit the form again.'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hook_validate_signup_authorization(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_validate_signup_authorization(jsonb) FROM anon, authenticated, public;
