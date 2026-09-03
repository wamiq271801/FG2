/**
 * Supabase project configuration.
 *
 * TEST PROJECT KEYS — disposable, will be replaced after development.
 * These are hardcoded defaults so the app works even if .env is overwritten
 * by the sandbox boot script. Production deployments override via env vars.
 */

// Project ref: onyzjnitnekjhdexecdm
import { SITE_ORIGIN } from "@/lib/site";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://onyzjnitnekjhdexecdm.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXpqbml0bmVramhkZXhlY2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMzc2NTUsImV4cCI6MjEwMjYxMzY1NX0.GqXaLdE4txXx5cooRRc4TS01OfjVzP4Sq8MxfpGY-HA";

// Canonical site origin — delegated to lib/site.ts (env-backed, single
// source of truth for absolute URLs and stable schema.org entity IDs).
export const SITE_URL = SITE_ORIGIN;

// Server-only (NEVER imported by client code). Used by Worker + ProcessingServer.
export const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ueXpqbml0bmVramhkZXhlY2RtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzAzNzY1NSwiZXhwIjoyMTAyNjEzNjU1fQ.XcDlBReiaBQRg7xcftYqu5wMFG9zQhPTYvetc6G4Exk";
