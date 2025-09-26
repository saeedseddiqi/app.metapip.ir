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
  // Choose provider based on env: default to 'oidc', allow 'clerk' if explicitly set
  const envProvider = (process.env.NEXT_PUBLIC_SUPABASE_IDENTITY_PROVIDER as string | undefined);
  const provider = ((envProvider || "oidc").toLowerCase() === "clerk") ? "clerk" : "oidc";
  const enabled = (() => {
    const v = String(process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();

  // Resolve Clerk template and session mode from env
  const templateEnv = (process.env.NEXT_PUBLIC_CLERK_SUPABASE_TEMPLATE as string | undefined);
  const template = templateEnv && templateEnv.trim().length > 0 ? templateEnv : "supabase";
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
        let token = await getToken?.({ template, /* request fresh token when possible */ skipCache: true } as any);
        if (!token) token = await (getToken?.({ template: "session", skipCache: true } as any) as Promise<string | null>);
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
        triedRef.current = false; // allow retry on next render
        options?.onError?.(e);
      }
    })();
  }, [enabled, isLoaded, isSignedIn, getToken, options]);
}
