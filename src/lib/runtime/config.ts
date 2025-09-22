"use client";

import { add as log } from "@/lib/diagnostics/logger";

// IMPORTANT
// This module now reads configuration directly from process.env (including NEXT_PUBLIC_*).
// No remote envs API or Supabase bootstrap is used anymore.

export type AppConfigMap = Record<string, string>;

let runtimeConfig: AppConfigMap | null = null;

// No remote envs API; envs are read from process.env

// Remote envs item shape from serverless endpoint
export type RemoteEnvItem = { key: string; value: string; is_secret?: boolean | null };

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

function firstEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

// Return envs from process.env so DiagnosticsPanel can display them without network
export async function fetchRemoteEnvs(): Promise<RemoteEnvItem[]> {
  const keys = [
    // Clerk
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_CLERK_CLIENT_ID",
    "NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID",
    "NEXT_PUBLIC_CLERK_BASE_URL",
    "NEXT_PUBLIC_CLERK_OAUTH_BASE",
    "NEXT_PUBLIC_CLERK_HOSTED_URL",
    // Supabase
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL",
    // App flags
    "NEXT_PUBLIC_DESKTOP_DISABLE_CLERK",
    "NEXT_PUBLIC_SUPABASE_SESSION_ENABLED",
    "NEXT_PUBLIC_TOKEN_FILE",
    "NEXT_PUBLIC_DISABLE_TOKEN_FILE",
    "NEXT_PUBLIC_TOKEN_DIR",
  ];
  const out: RemoteEnvItem[] = [];
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined) out.push({ key: k, value: String(v), is_secret: false });
  }
  return out;
}

export async function initRuntimeConfig(): Promise<AppConfigMap> {
  const cfg: AppConfigMap = {};
  // Clerk
  const publishable = firstEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_PUBLISHABLE_KEY");
  const clientId = firstEnv("NEXT_PUBLIC_CLERK_CLIENT_ID", "NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID", "CLERK_CLIENT_ID");
  const baseUrl = firstEnv("NEXT_PUBLIC_CLERK_BASE_URL", "NEXT_PUBLIC_CLERK_OAUTH_BASE", "CLERK_BASE_URL");
  const hostedUrl = firstEnv("NEXT_PUBLIC_CLERK_HOSTED_URL", "CLERK_HOSTED_URL");

  if (publishable) cfg["CLERK_PUBLISHABLE_KEY"] = publishable;
  if (clientId) cfg["CLERK_CLIENT_ID"] = clientId;
  if (baseUrl) cfg["CLERK_BASE_URL"] = baseUrl;
  if (hostedUrl) cfg["CLERK_HOSTED_URL"] = hostedUrl;

  // Supabase
  const supaUrl = firstEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const supaAnon = firstEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  if (supaUrl) cfg["SUPABASE_URL"] = supaUrl;
  if (supaAnon) cfg["SUPABASE_ANON_KEY"] = supaAnon;

  // App flags
  const desktopDisable = firstEnv("NEXT_PUBLIC_DESKTOP_DISABLE_CLERK", "DESKTOP_DISABLE_CLERK") ?? "0";
  cfg["DESKTOP_DISABLE_CLERK"] = desktopDisable;

  const sessionEnabled = firstEnv("NEXT_PUBLIC_SUPABASE_SESSION_ENABLED");
  if (sessionEnabled) cfg["SUPABASE_SESSION_ENABLED"] = sessionEnabled;

  runtimeConfig = cfg;
  try { log("success", "[Config] Runtime config loaded", { keys: Object.keys(cfg) }); } catch {}
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
