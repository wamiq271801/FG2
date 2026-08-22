-- ============================================================
-- DEV ONLY — creates auth.users rows matching the profiles seeded by seed.sql.
-- This lets you actually log in during local development/testing.
-- DO NOT run in production. Passwords below are intentionally weak and public.
--
-- Test users:
--   riya.sharma@example.com  /  fusion123       (onboarding complete, has orders)
--   onboarding@example.com   /  onboard123      (onboarding incomplete)
--
-- The on_auth_user_created trigger (0001_schema.sql) will try to insert a profile
-- for each new auth.users row; seed.sql already seeded those profile rows, so the
-- trigger's INSERT ... ON CONFLICT DO NOTHING is a no-op and the seeded profile
-- (with the right onboarding_state) is kept.
-- ============================================================
BEGIN;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, phone_change_token,
  email_change, email_change_token_current, phone_change,
  created_at, updated_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, deleted_at
) VALUES
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'riya.sharma@example.com',
  crypt('fusion123', gen_salt('bf')),
  now(), NULL, NULL,
  '', '', '', '',
  '', '', '',
  now(), now(), NULL,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Riya Sharma"}'::jsonb,
  false, NULL
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated',
  'onboarding@example.com',
  crypt('onboard123', gen_salt('bf')),
  now(), NULL, NULL,
  '', '', '', '',
  '', '', '',
  now(), now(), NULL,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Test Onboarding"}'::jsonb,
  false, NULL
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
