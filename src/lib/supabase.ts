import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { add as diagLog } from "@/lib/diagnostics/logger";
import { loadDesktopEnv, readDesktopEnv } from "@/lib/desktopEnv";

let internalClient: SupabaseClient | null = null;
export let isSupabaseConfigured = false;

function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

function ensureClient(): SupabaseClient {
  if (internalClient) return internalClient;
  // In Tauri desktop, prefer cached runtime env injected via get_public_envs
  if (isTauriRuntime()) {
    const envs = readDesktopEnv();
    const url = (envs.NEXT_PUBLIC_SUPABASE_URL || "").toString();
    const anon = (envs.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").toString();
    if (url && anon) {
      internalClient = createClient(url, anon, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      isSupabaseConfigured = true;
      try { diagLog("success", "[Supabase] Client initialized from Tauri env", { url: maskUrl(url) }); } catch {}
      return internalClient;
    }
    // Fallback to build-time env if desktop env is not yet loaded (avoids early throw during first render)
    try { diagLog("warn", "[Supabase] Tauri env not loaded yet; falling back to process.env"); } catch {}
  }
  // Web fallback: read from build-time env
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").toString();
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").toString();
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL missing in env. Set it in .env.local or deployment envs.");
  }
  if (!anon) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing in env. Set it in .env.local or deployment envs.");
  }
  internalClient = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  isSupabaseConfigured = true;
  try { diagLog("success", "[Supabase] Client initialized from env", { url: maskUrl(url) }); } catch {}
  return internalClient;
}

function maskUrl(u: string) {
  try { const o = new URL(u); return `${o.protocol}//${o.hostname}`; } catch { return u; }
}

// Backward-compatible default export value via Proxy, so existing imports work:
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = ensureClient();
    // @ts-ignore
    const value = client[prop];
    // Bind functions to client to preserve 'this'
    if (typeof value === "function") return value.bind(client);
    return Reflect.get(client as any, prop, receiver);
  },
});

// Optional explicit initializer for places like app startup
export function configureSupabaseFromRuntime(): SupabaseClient {
  return ensureClient();
}

// Desktop bootstrap: load envs from Tauri and create client
export async function configureSupabaseForDesktop(): Promise<SupabaseClient> {
  if (internalClient) return internalClient;
  await loadDesktopEnv();
  return ensureClient();
}
