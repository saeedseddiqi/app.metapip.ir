import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { add as diagLog } from "@/lib/diagnostics/logger";

let internalClient: SupabaseClient | null = null;
export let isSupabaseConfigured = false;

function ensureClient(): SupabaseClient {
  if (internalClient) return internalClient;
  // Read Supabase credentials directly from environment variables (no runtime/API fetch).
  // For client-side bundles, Next.js will inline NEXT_PUBLIC_* values.
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
