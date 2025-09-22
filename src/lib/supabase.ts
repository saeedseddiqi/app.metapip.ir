import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseAnonKey, isRuntimeConfigReady } from "@/lib/runtime/config";
import { add as diagLog } from "@/lib/diagnostics/logger";

let internalClient: SupabaseClient | null = null;
export let isSupabaseConfigured = false;

function ensureClient(): SupabaseClient {
  if (internalClient) return internalClient;
  if (!isRuntimeConfigReady()) {
    throw new Error("Runtime config not loaded. Call initRuntimeConfig() before using Supabase.");
  }
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  internalClient = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  isSupabaseConfigured = true;
  try { diagLog("success", "[Supabase] Client initialized from runtime config", { url: maskUrl(url) }); } catch {}
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
