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
  // Choose provider based on env: default to 'clerk' (TPA), allow 'oidc' if explicitly set
  const envProvider = (process.env.NEXT_PUBLIC_SUPABASE_IDENTITY_PROVIDER as string | undefined);
  const provider = ((envProvider || "clerk").toLowerCase() === "oidc") ? "oidc" : "clerk";
  const enabled = (() => {
    const v = String(process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();

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
        // Prefer a Clerk JWT template named 'supabase' (OIDC-friendly), fallback to session
        let token = await getToken?.({ template: "supabase" } as any);
        if (!token) token = await (getToken?.({ template: "session" } as any) as Promise<string | null>);
        if (!token) throw new Error("Clerk token not available");
        const { error } = await supabase.auth.signInWithIdToken({ provider: provider as any, token });
        if (error) throw error;
        const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionRes.session) throw sessionErr || new Error("No Supabase session");
        options?.onSignedIn?.();
      } catch (e) {
        console.error("[SupabaseSession] signInWithIdToken failed", e);
        triedRef.current = false; // allow retry on next render
        options?.onError?.(e);
      }
    })();
  }, [enabled, isLoaded, isSignedIn, getToken, options]);
}
