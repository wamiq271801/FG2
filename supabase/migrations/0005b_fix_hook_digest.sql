-- Fix: hook_validate_signup_authorization failed with
--   "function public.digest(text, text) does not exist"
-- Root cause: pgcrypto is installed in the `extensions` schema on Supabase,
-- not `public`. Calling public.digest() fails because the function doesn't
-- exist there. The fix is to qualify the call as extensions.digest() explicitly.
--
-- Additionally binds the algorithm to a `text` variable (v_algo) so Postgres
-- resolves the overload to extensions.digest(text, text) without ambiguity.

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
