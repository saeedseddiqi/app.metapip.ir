"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { HeroUIProvider } from "@heroui/system";
import { useClerkSyncAndDevice } from "@/lib/auth/hooks";
import { useClerkSupabaseSession } from "@/lib/auth/useClerkSupabaseSession";
import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { useDeepLinkListener, parseClerkToken, exchangeClerkOAuthCode } from "@/lib/auth/deepLink";
import { supabase } from "@/lib/supabase";
import { invoke } from "@tauri-apps/api/core";
import { openHostedSignIn } from "@/lib/auth/deepLink";
import { useRouter } from "next/navigation";
import { add as diagLog } from "@/lib/diagnostics/logger";
import { initRuntimeConfig, isDesktopMode, getClerkPublishableKey } from "@/lib/runtime/config";
import { configureSupabaseFromRuntime } from "@/lib/supabase";
import { getPkce, clearPkce } from "@/lib/auth/pkceStore";
import { ClerkProvider } from "@clerk/nextjs";

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [bootError, setBootError] = React.useState<string | null>(null);
  const [webKey, setWebKey] = React.useState<string | null>(null);
  const desktopMode = isDesktopMode();
  const router = useRouter();
  // Runtime bootstrap: fetch config from Supabase and initialize Supabase client
  React.useEffect(() => {
    (async () => {
      try {
        await initRuntimeConfig();
        configureSupabaseFromRuntime();
        // Derive Clerk publishable key only in web mode; show helpful error if missing
        try {
          if (!isDesktopMode()) {
            const k = getClerkPublishableKey();
            setWebKey(k);
          }
        } catch (e: any) {
          setWebKey(null);
          setBootError("CLERK_PUBLISHABLE_KEY missing. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local or Vercel Project Settings (Environment Variables).");
        }
        setReady(true);
        try { diagLog("success", "[Bootstrap] Runtime config + Supabase ready"); } catch {}
      } catch (e: any) {
        setBootError(e?.message || String(e));
        try { diagLog("error", "[Bootstrap] Failed to initialize runtime config", { error: String(e?.message || e) }); } catch {}
      }
    })();
  }, []);
  // Register deep link scheme at runtime for dev on Windows/Linux
  React.useEffect(() => {
    (async () => {
      try {
        if (typeof window === "undefined") return;
        const isTauri = Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
        if (!isTauri) return;
        const deep = await import("@tauri-apps/plugin-deep-link").catch(() => null as any);
        if (deep && typeof (deep as any).register === "function") {
          await (deep as any).register("metapip");
          try { console.log("[DeepLink] runtime scheme registered: metapip"); } catch {}
        }
      } catch (e) {
        console.warn("[DeepLink] runtime register failed", e);
      }
    })();
  }, []);
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (typeof window === "undefined") return;
        const isTauri = Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
        if (!isTauri) return;
        const { check } = await import("@tauri-apps/plugin-updater");
        // If dialog: true in tauri.conf.json, calling check() will present the native dialog.
        const result = await check();
        if (!cancelled && result?.available) {
          // When dialog is enabled, built-in UI handles download/install.
          // Optionally log or emit an event here if needed.
          // const { relaunch } = await import("@tauri-apps/api/process");
          // await result.downloadAndInstall();
          // await relaunch();
        }
      } catch (err) {
        // Silently ignore updater errors in non-tauri dev or when offline.
        // console.debug("Updater check failed", err);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // If running in Tauri desktop mode without ClerkProvider, auto-open hosted sign-in once
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!ready) return;
        if (typeof window === "undefined") return;
        const isTauri = Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
        if (!isTauri) return;
        if (!desktopMode) return; // only when ClerkProvider is disabled
        // if we already have a secure token, skip
        let hasSecure = false;
        try {
          const tok = await invoke<string>("load_secure_token", { accountId: null } as any);
          hasSecure = Boolean(tok && typeof tok === "string" && !tok.startsWith("ERR:") && tok.trim().length > 0);
        } catch {}
        if (hasSecure) return;
        // if we already have a supabase session, skip
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session) return;
        } catch {}
        // avoid opening too frequently in dev reloads
        const now = Date.now();
        const last = Number(sessionStorage.getItem("openHostedSignIn:last") || "0");
        if (!cancelled && now - last > 5000) {
          sessionStorage.setItem("openHostedSignIn:last", String(now));
          await openHostedSignIn("metapip://auth/callback");
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [desktopMode, ready]);

  // Listen to tray 'check_update' event and re-run updater check on demand
  React.useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        if (typeof window === "undefined") return;
        const isTauri = Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
        if (!isTauri) return;
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("check_update", async () => {
          try {
            const { check } = await import("@tauri-apps/plugin-updater");
            await check();
          } catch {}
        });
      } catch {}
    })();
    return () => { try { unlisten && unlisten(); } catch {} };
  }, []);
  // Bootstrap component to run hooks (Clerk sync) and always listen for deep links
  function ClerkBootstrap({ children }: { children: React.ReactNode }) {
    // Always run device sync (now provider-agnostic)
    try { useClerkSyncAndDevice(); } catch {}
    // Only call Clerk session bridge in web mode
    if (!desktopMode) { try { useClerkSupabaseSession(); } catch {} }
    // Deep link auth bridge for Tauri:
    //  - OIDC token: metapip://auth/callback?clerk_token=...
    //  - OAuth PKCE: metapip://auth/callback?code=...&state=...
    let setActive: undefined | ((args: any) => Promise<void>);
    if (!desktopMode) {
      try { setActive = useClerk().setActive; } catch {}
    }
    useEffect(() => {
      const unsub = useDeepLinkListener(async (url) => {
        try {
          const { token, sessionId, code, state, error: errStr } = parseClerkToken(url);
          try { diagLog("info", "[Auth] Callback parsed", { hasToken: !!token, hasCode: !!code, hasState: !!state, err: errStr || null }); } catch {}
          let oidcToken: string | undefined = token;
          // If we didn't get a direct id_token, try exchanging OAuth code using stored PKCE verifier
          if (!oidcToken && code) {
            try {
              const { verifier: storedVerifier, state: storedState, redirect: storedRedirect } = getPkce();
              const redirectUri = storedRedirect || "metapip://auth/callback";
              if (storedState && state && storedState !== state) {
                console.error("[DeepLink] OAuth state mismatch", { storedState, state });
                try { diagLog("error", "[Auth] OAuth state mismatch", { storedState, state }); } catch {}
                return;
              }
              if (!storedVerifier) {
                console.error("[DeepLink] Missing PKCE code_verifier in storage");
                try { diagLog("error", "[Auth] Missing PKCE code_verifier in storage"); } catch {}
                return;
              }
              try { diagLog("info", "[Auth] Exchanging code using PKCE", { redirectUri }); } catch {}
              const res = await exchangeClerkOAuthCode(code, storedVerifier, redirectUri);
              if (res?.id_token) {
                oidcToken = res.id_token;
                try { diagLog("success", "[Auth] Received id_token from token endpoint"); } catch {}
              } else {
                console.error("[DeepLink] OAuth token exchange failed", res?.error || res);
                try { diagLog("error", "[Auth] OAuth token exchange failed", res?.error || res); } catch {}
                return;
              }
            } catch (ex) {
              console.error("[DeepLink] OAuth code exchange exception", ex);
              try { diagLog("error", "[Auth] OAuth code exchange exception", { error: String((ex as any)?.message || ex) }); } catch {}
              return;
            } finally {
              try { clearPkce(); } catch {}
            }
          }
          if (!oidcToken) {
            if (errStr) console.error("[DeepLink] Clerk returned error in callback:", errStr);
            // Clear PKCE temp storage to avoid stale verifier/state across retries
            try { clearPkce(); } catch {}
            try { diagLog("error", "[Auth] Callback without token or code", { err: errStr || null }); } catch {}
            return;
          }
          // Create Supabase session using Clerk id_token
          try {
            const prov = (process.env.NEXT_PUBLIC_SUPABASE_IDENTITY_PROVIDER || "oidc").toString().toLowerCase() === "clerk" ? "clerk" : "oidc";
            const { error } = await supabase.auth.signInWithIdToken({ provider: prov as any, token: oidcToken });
            if (error) {
              console.error("[DeepLink] supabase signIn error", error);
              try { diagLog("error", "[Auth] Supabase signInWithIdToken error", { error }); } catch {}
            } else {
              try { diagLog("success", "[Auth] Supabase session established via OIDC"); } catch {}
            }
          } catch (e) { console.error("[DeepLink] supabase signIn exception", e); }
          // Activate Clerk session so <SignedIn> gates pass (web mode only)
          try {
            if (!desktopMode && sessionId && setActive) {
              await setActive({ session: sessionId });
              try { diagLog("success", "[Auth] Clerk setActive session", { sessionId }); } catch {}
            }
          } catch (e) {
            console.warn("[DeepLink] setActive failed", e);
            try { diagLog("warn", "[Auth] Clerk setActive failed", { error: String((e as any)?.message || e) }); } catch {}
          }
          // Persist Supabase access_token securely for device flows (best-effort)
          try {
            const { data: sessionRes } = await supabase.auth.getSession();
            const access = sessionRes?.session?.access_token;
            if (access) {
              await invoke("save_secure_token", { accountId: null, token: access });
              try { diagLog("success", "[Auth] Secure token persisted in keyring"); } catch {}
            }
          } catch {}
          // Bring app to front and navigate to /dashboard
          try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            const win = getCurrentWindow();
            try { await win.show(); await win.setFocus(); } catch {}
            try { diagLog("info", "[Auth] Focused main window"); } catch {}
          } catch {}
          try { router.replace("/dashboard"); try { diagLog("success", "[Auth] Navigated to /dashboard"); } catch {} } catch {}
        } catch (e) {
          console.error("[DeepLink] handler error", e);
          try { diagLog("error", "[Auth] Deep link handler exception", { error: String((e as any)?.message || e) }); } catch {}
        }
      });
      return () => { try { unsub(); } catch {} };
    }, [setActive]);
    return <>{children}</>;
  }
  return (
    <HeroUIProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="theme"
        disableTransitionOnChange
      >
        {!ready ? (
          <div className="min-h-[40vh] flex items-center justify-center" dir="rtl">
            {bootError ? (
              <div className="p-4 rounded border border-red-300 bg-red-50 dark:bg-red-950/30 text-sm">
                <div className="font-semibold mb-1">خطای راه‌اندازی پیکربندی</div>
                <div className="opacity-80">{bootError}</div>
              </div>
            ) : (
              <div className="p-4 rounded border bg-white dark:bg-zinc-900 text-sm opacity-80">در حال بارگذاری تنظیمات…</div>
            )}
          </div>
        ) : desktopMode ? (
          <ClerkBootstrap>
            {children}
          </ClerkBootstrap>
        ) : !webKey ? (
          <div className="min-h-[40vh] flex items-center justify-center" dir="rtl">
            <div className="p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 text-sm max-w-xl">
              <div className="font-semibold mb-1">خطا: کلید Clerk برای وب پیدا نشد</div>
              <ul className="list-disc pr-5 space-y-1 opacity-90">
                <li>در سرویس envs مقدار <code>CLERK_PUBLISHABLE_KEY</code> را تنظیم کنید (به‌صورت غیر-Secret).</li>
                <li>پس از تغییر، Dev را ری‌استارت کنید یا ۶۰ ثانیه صبر کنید تا کش middleware منقضی شود.</li>
                <li>برای بررسی، به <code>/settings/diagnostics</code> بروید و وضعیت کلیدها را ببینید.</li>
              </ul>
              {bootError && <div className="mt-2 text-xs opacity-70">{bootError}</div>}
            </div>
          </div>
        ) : (
          <ClerkProvider publishableKey={webKey}>
            <ClerkBootstrap>
              {children}
            </ClerkBootstrap>
          </ClerkProvider>
        )}
      </ThemeProvider>
    </HeroUIProvider>
  );
}

