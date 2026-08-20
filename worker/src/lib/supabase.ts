import type { Env } from "../config/env";

const DEFAULT_TIMEOUT = 10000;

export async function supabaseAuthFetch(
  env: Env,
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(`${env.SUPABASE_URL}${path}`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    if (text) {
      try { data = JSON.parse(text); } catch {}
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 502 };
  } finally {
    clearTimeout(timeout);
  }
}

export async function supabaseRestFetch(
  env: Env,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data?: unknown }> {
  const headers: Record<string, string> = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
  };
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch {}
  }
  return { ok: res.ok, status: res.status, data };
}

export async function verifyUser(env: Env, request: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.id || !data?.email) return null;
  return { id: data.id as string, email: data.email as string };
}
