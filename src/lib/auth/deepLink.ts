"use client";

import { listen } from "@tauri-apps/api/event";
import { createPkcePair } from "@/lib/auth/pkce";
import { add as diagLog } from "@/lib/diagnostics/logger";
import { getClerkBaseUrl, getClerkClientId, isRuntimeConfigReady } from "@/lib/runtime/config";
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
  if (!isRuntimeConfigReady()) throw new Error("Runtime config not loaded");
  // OAuth PKCE flow (no fallback). All values from runtime config.
  const oauthBase = getClerkBaseUrl();
  const clientId = getClerkClientId();
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
  // Prefer Tauri opener when available; otherwise fallback to window.open
  const isTauri = typeof window !== "undefined" && (Boolean((window as any).__TAURI__) || Boolean((window as any).__TAURI_INTERNALS__));
  try { console.log("[DeepLink] openHostedSignIn ->", url.toString(), "isTauri=", isTauri); } catch {}
  try { diagLog("info", "[Auth] Opening sign-in URL", { isTauri }); } catch {}
  if (isTauri) {
    // Use plugin-opener only; do not use window.open in Tauri WebView
    try {
      const mod: any = await import("@tauri-apps/plugin-opener");
      const cand = (mod && (mod.open || mod.default || mod?.default?.open)) as any;
      if (typeof cand === "function") {
        await cand(url.toString());
        console.log("[DeepLink] Opened via @tauri-apps/plugin-opener");
        try { diagLog("success", "[Auth] Opened via plugin-opener"); } catch {}
        return;
      }
      throw new Error("plugin-opener: no callable export found (open/default)");
    } catch (e) {
      console.warn("[DeepLink] plugin-opener JS wrapper failed, trying core.invoke", e);
      try { diagLog("warn", "[Auth] plugin-opener wrapper failed, trying core.invoke", { error: String((e as any)?.message || e) }); } catch {}
      try {
        const core: any = await import("@tauri-apps/api/core");
        if (typeof core?.invoke === "function") {
          await core.invoke("plugin:opener|open_url", { url: url.toString() });
          console.log("[DeepLink] Opened via core.invoke('plugin:opener|open_url')");
          try { diagLog("success", "[Auth] Opened via core.invoke opener"); } catch {}
          return;
        }
      } catch (e2) {
        console.error("[DeepLink] core.invoke fallback failed", e2);
        try { diagLog("error", "[Auth] core.invoke opener failed", { error: String((e2 as any)?.message || e2) }); } catch {}
      }
    }
    // Last resort: copy to clipboard (no window.open in Tauri)
    try { await navigator.clipboard.writeText(url.toString()); } catch {}
    console.error("[DeepLink] Could not open URL automatically. Link copied to clipboard:", url.toString());
    try { diagLog("error", "[Auth] Could not open URL automatically; copied to clipboard"); } catch {}
    return;
  }

  // Fallback for non-Tauri environments (standard web browsers)
  try {
    const w = window.open(url.toString(), "_blank", "noopener,noreferrer");
    if (!w) {
      // Popup blocked or not supported.
      console.warn("[DeepLink] Popup was blocked. Please enable popups for this site.");
      try { diagLog("warn", "[Auth] Popup was blocked in web browser"); } catch {}
    }
  } catch (e) {
    console.error("[DeepLink] window.open failed:", e);
    try { diagLog("error", "[Auth] window.open failed", { error: String((e as any)?.message || e) }); } catch {}
  }
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
  if (!isRuntimeConfigReady()) throw new Error("Runtime config not loaded");
  const oauthBase = getClerkBaseUrl();
  const clientId = getClerkClientId();
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
