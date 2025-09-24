"use client";

import { listen } from "@tauri-apps/api/event";
import { createPkcePair } from "@/lib/auth/pkce";
import { add as diagLog } from "@/lib/diagnostics/logger";
import { setPkce } from "@/lib/auth/pkceStore";

export type DeepLinkHandler = (url: string) => void;

export function parseClerkToken(deepLinkUrl: string): { token?: string; sessionId?: string; code?: string; state?: string; error?: string } {
  try {
    const u = new URL(deepLinkUrl);
    const token = u.searchParams.get("clerk_token") || u.searchParams.get("token") || u.searchParams.get("jwt");
    const sessionId = u.searchParams.get("session_id") || u.searchParams.get("created_session_id");
    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    const error = u.searchParams.get("error") || u.searchParams.get("error_description") || undefined;
    return { token: token || undefined, sessionId: sessionId || undefined, code: code || undefined, state: state || undefined, error };
  } catch {
    return {};
  }
}

export async function openHostedSignIn(redirectUrl = "metapip://auth/callback") {
  // OAuth PKCE flow using env-only values (no runtime/config).
  const oauthBase = getClerkBaseUrlFromEnv();
  const clientId = getClerkClientIdFromEnv();
  const auth = new URL(`${oauthBase.replace(/\/$/, "")}/oauth/authorize`);
  const { verifier, challenge, method } = await createPkcePair();
  // random state
  const stateBytes = new Uint8Array(16);
  (crypto as any).getRandomValues?.(stateBytes);
  const state = Array.from(stateBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  // keep verifier/state in RAM only
  setPkce(verifier, state, redirectUrl);
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUrl);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("code_challenge_method", method);
  auth.searchParams.set("code_challenge", challenge);
  const scope = "openid"; // Scope is fixed per requirement
  auth.searchParams.set("scope", scope);
  auth.searchParams.set("state", state);
  const url = auth;
  try { diagLog("info", "[Auth] Built OAuth authorize URL", { base: oauthBase, scope, hasClientId: true }); } catch {}
  // Prefer Tauri Shell API when available; otherwise fallback to window.open
  const isTauri = typeof window !== "undefined" && (Boolean((window as any).__TAURI__) || Boolean((window as any).__TAURI_INTERNALS__));
  try { console.log("[DeepLink] openHostedSignIn ->", url.toString(), "isTauri=", isTauri); } catch {}
  try { diagLog("info", "[Auth] Opening sign-in URL", { isTauri }); } catch {}
  await openOAuthUrl(url.toString());
}

export function useDeepLinkListener(onUrl: DeepLinkHandler) {
  // Returns an unsubscribe function
  let un: undefined | (() => void);
  const sub = async () => {
    try {
      un = await listen<string>("deep_link_url", (ev) => {
        const url = String(ev.payload || "");
        if (url.startsWith("metapip://")) {
          try { console.log("[DeepLink] received:", url); } catch {}
          try {
            const u = new URL(url);
            const hasCode = !!u.searchParams.get("code");
            const hasToken = !!(u.searchParams.get("clerk_token") || u.searchParams.get("token") || u.searchParams.get("jwt"));
            const err = u.searchParams.get("error") || u.searchParams.get("error_description");
            diagLog("info", "[Auth] Deep link received", { hasCode, hasToken, error: err ? true : false });
          } catch {}
          onUrl(url);
        }
      });
    } catch {}
  };
  sub();
  return () => { try { un && un(); } catch {} };
}

// Exchange OAuth code for tokens at Clerk token endpoint
export async function exchangeClerkOAuthCode(code: string, codeVerifier: string, redirectUri: string): Promise<{ id_token?: string; access_token?: string; refresh_token?: string; raw?: any; error?: any }> {
  const oauthBase = getClerkBaseUrlFromEnv();
  const clientId = getClerkClientIdFromEnv();
  const tokenUrl = `${oauthBase.replace(/\/$/, "")}/oauth/token`;
  try { diagLog("info", "[Auth] Exchanging OAuth code for tokens", { base: oauthBase, hasClientId: true }); } catch {}
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    try { diagLog("error", "[Auth] Token exchange failed", { status: res.status, body: json }); } catch {}
    return { error: json, raw: json };
  }
  try { diagLog("success", "[Auth] Token exchange succeeded"); } catch {}
  return { id_token: json.id_token, access_token: json.access_token, refresh_token: json.refresh_token, raw: json };
}

// Helpers to read Clerk config from env (client-safe NEXT_PUBLIC_*), with clear errors if missing
function getClerkBaseUrlFromEnv(): string {
  const base = (process.env.NEXT_PUBLIC_CLERK_BASE_URL as string | undefined)
    || (process.env.NEXT_PUBLIC_CLERK_OAUTH_BASE as string | undefined)
    || (process.env.NEXT_PUBLIC_CLERK_HOSTED_URL as string | undefined);
  if (!base) throw new Error("CLERK_BASE_URL missing. Set NEXT_PUBLIC_CLERK_BASE_URL (or NEXT_PUBLIC_CLERK_OAUTH_BASE) in env.");
  return base;
}

function getClerkClientIdFromEnv(): string {
  const id = (process.env.NEXT_PUBLIC_CLERK_CLIENT_ID as string | undefined)
    || (process.env.NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID as string | undefined);
  if (!id) throw new Error("CLERK_CLIENT_ID missing. Set NEXT_PUBLIC_CLERK_CLIENT_ID (or NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID) in env.");
  return id;
}

// Open a URL for OAuth/OIDC in the system browser using Tauri Shell API when available.
export async function openOAuthUrl(url: string) {
  const isTauri = typeof window !== "undefined" && (Boolean((window as any).__TAURI__) || Boolean((window as any).__TAURI_INTERNALS__));
  if (isTauri) {
    try {
      const { open } = await import("@tauri-apps/api/shell");
      await open(url);
      try { diagLog("success", "[Auth] Opened via Tauri Shell API"); } catch {}
      return;
    } catch (e) {
      console.warn("[DeepLink] Tauri Shell open failed", e);
      try { diagLog("error", "[Auth] Tauri Shell open failed", { error: String((e as any)?.message || e) }); } catch {}
      try { await navigator.clipboard.writeText(url); } catch {}
      console.error("[DeepLink] Copied URL to clipboard as fallback:", url);
      return;
    }
  }
  // Fallback for non-Tauri environments (standard web browsers)
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      console.warn("[DeepLink] Popup was blocked. Please enable popups for this site.");
      try { diagLog("warn", "[Auth] Popup was blocked in web browser"); } catch {}
    }
  } catch (e) {
    console.error("[DeepLink] window.open failed:", e);
    try { diagLog("error", "[Auth] window.open failed", { error: String((e as any)?.message || e) }); } catch {}
  }
}
