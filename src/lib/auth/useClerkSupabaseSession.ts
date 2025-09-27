"use client";
import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Establishes a client-side Supabase session using the current Clerk JWT.
 * This enables RLS/Storage access from the client. Safe to call repeatedly.
 */
export function useClerkSupabaseSession(options?: { onSignedIn?: () => void; onError?: (e: any) => void }) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const triedRef = React.useRef(false);
  const SUPABASE_TEMPLATE = "supabase" as const;
  // Choose provider based on env: default to 'oidc', allow 'clerk' if explicitly set
  const envProvider = (process.env.NEXT_PUBLIC_SUPABASE_IDENTITY_PROVIDER as string | undefined);
  const provider = ((envProvider || "oidc").toLowerCase() === "clerk") ? "clerk" : "oidc";
  const enabled = (() => {
    const v = String(process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();

  // Resolve session mode from env (template is fixed to 'supabase')
  const sessionModeEnv = (process.env.NEXT_PUBLIC_SUPABASE_SESSION_MODE as string | undefined);
  const sessionMode = ((sessionModeEnv || "id_token").toLowerCase() === "set_session") ? "set_session" : "id_token";

  React.useEffect(() => {
    if (!enabled) {
      // Client-side Supabase session is disabled; rely on Edge Functions/TPA instead.
      return;
    }
    (async () => {
      if (!isLoaded || !isSignedIn || !isSupabaseConfigured) return;
      if (triedRef.current) return; // avoid spamming sign-in attempts
      triedRef.current = true;
      try {
        // Prefer a Clerk JWT template from env (default 'supabase'), fallback to 'session'
        const token = await getToken?.({ template: SUPABASE_TEMPLATE, /* request fresh token when possible */ skipCache: true } as any);
        if (!token) throw new Error("Clerk token not available");
        if (sessionMode === "set_session") {
          // Use external JWT directly for Supabase requests (no refresh expected)
          const { error } = await (supabase.auth.setSession({ access_token: token, refresh_token: token } as any) as Promise<any>);
          if (error) throw error;
        } else {
          // Default and recommended: exchange the OIDC/Clerk token for a Supabase session
          const { error } = await supabase.auth.signInWithIdToken({ provider: provider as any, token });

          if (error) {
            // اگر provider کار نکرد، از setSession استفاده کنیم
            console.log('[SupabaseSession] signInWithIdToken failed, trying setSession...');
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: token,
              refresh_token: token
            } as any);
            if (setSessionError) throw setSessionError;
          }
        }
        const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionRes.session) throw sessionErr || new Error("No Supabase session");
        options?.onSignedIn?.();
      } catch (e) {
        console.error("[SupabaseSession] activation failed", e);
        // Attempt a one-time forced refresh of the Clerk token and retry activation
        try {
          const fresh = await getToken?.({ template: SUPABASE_TEMPLATE, skipCache: true } as any);
          if (fresh) {
            try {
              if (sessionMode === "set_session") {
                const { error } = await (supabase.auth.setSession({ access_token: fresh, refresh_token: fresh } as any) as Promise<any>);
                if (error) throw error;
              } else {
                const { error } = await supabase.auth.signInWithIdToken({ provider: provider as any, token: fresh });
                if (error) {
                  console.log('[SupabaseSession] retry signInWithIdToken failed, trying setSession...');
                  const { error: setSessionError } = await supabase.auth.setSession({ access_token: fresh, refresh_token: fresh } as any);
                  if (setSessionError) throw setSessionError;
                }
              }
              const { data: sessionRes2, error: sessionErr2 } = await supabase.auth.getSession();
              if (sessionErr2 || !sessionRes2.session) throw sessionErr2 || new Error('No Supabase session (retry)');
              options?.onSignedIn?.();
              return; // success on retry
            } catch (retryErr) {
              console.warn('[SupabaseSession] retry activation failed', retryErr);
            }
          }
        } catch (refreshErr) {
          console.warn('[SupabaseSession] token refresh attempt failed', refreshErr);
        }
        triedRef.current = false; // allow retry on next render
        options?.onError?.(e);
        try {
          // As a last resort, redirect user to sign-in page to re-establish Clerk session
          if (typeof window !== 'undefined') {
            setTimeout(() => { try { window.location.href = '/sign-in'; } catch {} }, 1000);
          }
        } catch {}
      }
    })();
  }, [enabled, isLoaded, isSignedIn, getToken, options]);

  // Clear Supabase session and desktop caches when user is signed out
  React.useEffect(() => {
    (async () => {
      try {
        if (!isLoaded) return;
        if (isSignedIn) return;
        // Signed out: clear supabase session
        try { await supabase.auth.signOut(); } catch {}
        // If running in Tauri desktop, clear runtime caches and secure token
        if (typeof window !== 'undefined' && ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('clear_secret_cache');
            await invoke('logout_account', { accountId: null } as any);
          } catch {}
        }
        try { console.log('[SupabaseSession] user signed out; cleared sessions/caches'); } catch {}
      } catch {}
    })();
  }, [isLoaded, isSignedIn]);
}
