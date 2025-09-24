"use client";

import { add as log } from "@/lib/diagnostics/logger";
import { createPkcePair } from "@/lib/auth/pkce";
import { supabase } from "@/lib/supabase";

export interface EnvSnapshot {
  NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID?: string;
  NEXT_PUBLIC_CLERK_OAUTH_BASE?: string;
  NEXT_PUBLIC_CLERK_OAUTH_SCOPE?: string;
  NEXT_PUBLIC_CLERK_HOSTED_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_DESKTOP_DISABLE_CLERK?: string;
}

export interface HealthReportItem {
  id: string;
  ok: boolean;
  details?: any;
  error?: string;
}

export interface HealthReport {
  items: HealthReportItem[];
  authorizeUrl?: string;
  wellKnown?: any;
  env: EnvSnapshot;
}

export function envSnapshot(): EnvSnapshot {
  return {
    NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID: process.env.NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID,
    NEXT_PUBLIC_CLERK_OAUTH_BASE: process.env.NEXT_PUBLIC_CLERK_OAUTH_BASE,
    NEXT_PUBLIC_CLERK_OAUTH_SCOPE: process.env.NEXT_PUBLIC_CLERK_OAUTH_SCOPE,
    NEXT_PUBLIC_CLERK_HOSTED_URL: process.env.NEXT_PUBLIC_CLERK_HOSTED_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_DESKTOP_DISABLE_CLERK: process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK,
  };
}

export async function buildAuthorizeUrl(redirectUrl = "metapip://auth/callback"): Promise<string> {
  const base = (process.env.NEXT_PUBLIC_CLERK_OAUTH_BASE as string) || "https://clerk.metapip.ir";
  const clientId = process.env.NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID as string | undefined;
  const scope = (process.env.NEXT_PUBLIC_CLERK_OAUTH_SCOPE as string) || "openid";
  if (!clientId) throw new Error("Missing NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID");
  const { challenge, method } = await createPkcePair();
  // For diagnostics, we do NOT persist verifier/state.
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const url = new URL(`${base.replace(/\/$/, "")}/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge_method", method);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function runHealthChecks(): Promise<HealthReport> {
  const items: HealthReportItem[] = [];
  const env = envSnapshot();

  // isTauri
  const isTauri = typeof window !== "undefined" && (Boolean((window as any).__TAURI__) || Boolean((window as any).__TAURI_INTERNALS__));
  items.push({ id: "isTauri", ok: isTauri });

  // opener plugin no longer used
  items.push({ id: "openerPluginAvailable", ok: true, details: "not required" });

  // deep-link plugin importable?
  try {
    const deep: any = isTauri ? await import("@tauri-apps/plugin-deep-link") : null;
    const ok = !isTauri || typeof deep?.register === "function";
    items.push({ id: "deepLinkPluginAvailable", ok });
  } catch (e: any) {
    items.push({ id: "deepLinkPluginAvailable", ok: false, error: String(e?.message || e) });
  }

  // api/core available?
  try {
    const core: any = isTauri ? await import("@tauri-apps/api/core") : null;
    const ok = !isTauri || typeof core?.invoke === "function";
    items.push({ id: "tauriCoreInvoke", ok });
  } catch (e: any) {
    items.push({ id: "tauriCoreInvoke", ok: false, error: String(e?.message || e) });
  }

  // env presence
  items.push({ id: "env:CLIENT_ID", ok: !!env.NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID, details: env.NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID ? "set" : "missing" });
  items.push({ id: "env:BASE", ok: !!env.NEXT_PUBLIC_CLERK_OAUTH_BASE, details: env.NEXT_PUBLIC_CLERK_OAUTH_BASE || "missing" });
  items.push({ id: "env:SCOPE", ok: !!(env.NEXT_PUBLIC_CLERK_OAUTH_SCOPE || "openid"), details: env.NEXT_PUBLIC_CLERK_OAUTH_SCOPE || "openid" });

  // well-known discovery
  let wellKnown: any = null;
  try {
    const base = (env.NEXT_PUBLIC_CLERK_OAUTH_BASE as string) || "https://clerk.metapip.ir";
    const res = await fetch(`${base.replace(/\/$/, "")}/.well-known/openid-configuration`, { method: "GET" });
    wellKnown = await res.json().catch(() => null);
    const ok = !!(wellKnown && wellKnown.authorization_endpoint && wellKnown.token_endpoint);
    items.push({ id: "oidcDiscovery", ok, details: { authorization_endpoint: wellKnown?.authorization_endpoint, token_endpoint: wellKnown?.token_endpoint } });
  } catch (e: any) {
    items.push({ id: "oidcDiscovery", ok: false, error: String(e?.message || e) });
  }

  // authorize URL build
  let authorizeUrl: string | undefined;
  try {
    authorizeUrl = await buildAuthorizeUrl();
    items.push({ id: "authorizeUrlBuilt", ok: true });
  } catch (e: any) {
    items.push({ id: "authorizeUrlBuilt", ok: false, error: String(e?.message || e) });
  }

  // Supabase session check (not an error if no session; we only check that SDK works)
  try {
    const { data, error } = await supabase.auth.getSession();
    const ok = !error;
    items.push({ id: "supabaseSessionAPI", ok, details: { hasSession: !!data?.session } });
  } catch (e: any) {
    items.push({ id: "supabaseSessionAPI", ok: false, error: String(e?.message || e) });
  }

  const report: HealthReport = { items, authorizeUrl, wellKnown, env };
  log("info", "[Diagnostics] Health check completed", report);
  return report;
}
