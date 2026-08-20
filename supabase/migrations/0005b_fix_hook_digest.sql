-- Fix: hook_validate_signup_authorization failed with
--   "function digest(text, unknown) does not exist"
-- because the 'sha256' literal is typed `unknown` in the SECURITY DEFINER
-- plpgsql context, and the unqualified `digest` could not resolve.
--
-- This fix: (1) binds the algorithm to a `text` variable so the call resolves
-- to pgcrypto's `digest(text, text)`, and (2) qualifies `digest` as
-- `public.digest` (where `CREATE EXTENSION pgcrypto` installs it in Supabase).
-- Run in the Supabase Dashboard SQL Editor.

CREATE OR REPLACE FUNCTION public.hook_validate_signup_authorization(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email        text;
  v_token        text;
  v_email_hash   text;
  v_token_hash   text;
  v_algo         text := 'sha256';
  v_ok           boolean;
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

  -- Normalize email the SAME way the Worker does (trim + lower), then hash.
  -- SHA-256 matches the Worker's crypto.subtle.digest('SHA-256').
  v_email_hash := encode(public.digest(lower(trim(v_email)), v_algo), 'hex');
  v_token_hash := encode(public.digest(v_token, v_algo), 'hex');

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
