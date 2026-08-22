-- Grant USAGE on public schema to supabase_auth_admin
-- This allows the Before User Created hook functions to execute properly
-- The hook functions are SECURITY DEFINER and run with postgres privileges,
-- but the auth_admin role needs USAGE to reference the functions in the schema

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;