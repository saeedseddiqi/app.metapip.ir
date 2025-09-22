"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { add as log } from "@/lib/diagnostics/logger";

// IMPORTANT
// This module enables a runtime-only configuration model.
// - No local .env is required for app runtime behavior.
// - A LIMITED public anon key is embedded ONLY for bootstrapping read-only access
//   to the `app_config` table (guarded by RLS). This anon key MUST have the
//   least privileges required (read-only, table-limited). Do NOT grant write.
// - All sensitive values (PKCE verifier, id_token) are only kept in memory.
// - After fetching config, consumers should use the getters below.

// TODO: Replace the placeholders below with your Supabase project's public URL
// and a limited, read-only anon key that can only read the `app_config` table via RLS.
const BOOTSTRAP_SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const BOOTSTRAP_SUPABASE_ANON_KEY = "PUBLIC_ANON_KEY_LIMITED";

export type AppConfigMap = Record<string, string>;

let runtimeConfig: AppConfigMap | null = null;
let bootstrapClient: SupabaseClient | null = null;

// Fixed remote envs API endpoint (no .env needed)
const REMOTE_ENVS_URL = "https://metapip-envs.vercel.app/api/envs";

// Remote envs item shape from serverless endpoint
export type RemoteEnvItem = {
  key: string;
  value: string;
  is_secret?: boolean | null;
};

function getBootstrapClient(): SupabaseClient {
  if (!bootstrapClient) {
    bootstrapClient = createClient(BOOTSTRAP_SUPABASE_URL, BOOTSTRAP_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return bootstrapClient;
}

function isBootstrapSupabaseConfigured(): boolean {
  try {
    if (!BOOTSTRAP_SUPABASE_URL || !BOOTSTRAP_SUPABASE_ANON_KEY) return false;
    if (BOOTSTRAP_SUPABASE_URL.includes("YOUR_PROJECT") || BOOTSTRAP_SUPABASE_ANON_KEY.includes("PUBLIC_ANON_KEY_LIMITED")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isRuntimeConfigReady(): boolean {
  return !!runtimeConfig;
}

export function getRuntimeConfig(): AppConfigMap {
  if (!runtimeConfig) throw new Error("Runtime config not loaded. Call initRuntimeConfig() first.");
  return runtimeConfig;
}

export function getConfigValue(key: string, fallback?: string): string | undefined {
  return (runtimeConfig && runtimeConfig[key]) || fallback;
}

// Fetch remote envs from the metapip-envs serverless endpoint
export async function fetchRemoteEnvs(remoteUrl?: string): Promise<RemoteEnvItem[]> {
  try {
    const url = remoteUrl || REMOTE_ENVS_URL;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const items = Array.isArray(json?.envs) ? (json.envs as any[]) : [];
    return items as RemoteEnvItem[];
  } catch (e: any) {
    try {
      log("warn", "[Config] fetchRemoteEnvs failed", { error: String(e?.message || e) });
    } catch {}
    return [];
  }
}

function mergeRemoteEnvsIntoConfig(cfg: AppConfigMap, items: RemoteEnvItem[], override = false) {
  let applied = 0;
  for (const it of items) {
    const k = String(it?.key || "").trim();
    if (!k) continue;
    const secret = Boolean((it as any)?.is_secret);
    if (secret) continue; // never expose secrets in frontend runtime config
    if (override || !(k in cfg)) {
      cfg[k] = String((it as any)?.value ?? "");
      applied += 1;
    }
  }
  try {
    log("info", "[Config] Remote envs merged", { applied, override });
  } catch {}
}

export async function fetchAppConfig(environment = "prod"): Promise<AppConfigMap> {
  const sb = getBootstrapClient();
  const { data, error } = await sb
    .from("app_config")
    .select("key,value,environment")
    .eq("environment", environment);
  if (error) throw error;
  const cfg: AppConfigMap = {};
  (data || []).forEach((row: any) => {
    if (row && row.key) cfg[row.key] = String(row.value ?? "");
  });
  return cfg;
}

export async function initRuntimeConfig(
  environment = "prod",
  opts?: { withRemoteEnvs?: boolean; remoteUrl?: string; override?: boolean }
): Promise<AppConfigMap> {
  const cfg: AppConfigMap = {};
  // 1) Optionally load remote envs first to allow bootstrap without Supabase
  if (opts?.withRemoteEnvs) {
    const items = await fetchRemoteEnvs(opts?.remoteUrl);
    mergeRemoteEnvsIntoConfig(cfg, items, Boolean(opts?.override));
  }
  // 2) If bootstrap client is configured, merge app_config values
  if (isBootstrapSupabaseConfigured()) {
    try {
      const supaCfg = await fetchAppConfig(environment);
      // Remote envs should not be overridden unless override flag was set above
      Object.entries(supaCfg).forEach(([k, v]) => {
        if (!(k in cfg)) cfg[k] = v;
      });
    } catch (e: any) {
      try { log("warn", "[Config] fetchAppConfig failed; using remote-only config", { error: String(e?.message || e) }); } catch {}
    }
  }
  runtimeConfig = cfg;
  try {
    log("success", "[Config] Runtime config loaded", { environment, keys: Object.keys(cfg) });
  } catch {}
  return cfg;
}

export function getClerkClientId(): string {
  const id = getConfigValue("CLERK_CLIENT_ID");
  if (!id) throw new Error("CLERK_CLIENT_ID missing in runtime config");
  return id;
}

export function getClerkBaseUrl(): string {
  const url = getConfigValue("CLERK_BASE_URL");
  if (!url) throw new Error("CLERK_BASE_URL missing in runtime config");
  return url;
}

export function getClerkPublishableKey(): string {
  const k = getConfigValue("CLERK_PUBLISHABLE_KEY");
  if (!k) throw new Error("CLERK_PUBLISHABLE_KEY missing in runtime config");
  return k;
}

export function getClerkHostedUrl(fallback?: string): string {
  const url = getConfigValue("CLERK_HOSTED_URL", fallback || "https://accounts.metapip.ir");
  return url as string;
}

export function isDesktopMode(): boolean {
  const v = String(getConfigValue("DESKTOP_DISABLE_CLERK", "0") || "0").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getConfigBool(key: string, fallback = false): boolean {
  const v = String(getConfigValue(key, fallback ? "1" : "0") || (fallback ? "1" : "0")).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getSupabaseUrl(): string {
  const url = getConfigValue("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL missing in runtime config");
  return url;
}

export function getSupabaseAnonKey(): string {
  const k = getConfigValue("SUPABASE_ANON_KEY");
  if (!k) throw new Error("SUPABASE_ANON_KEY missing in runtime config");
  return k;
}
