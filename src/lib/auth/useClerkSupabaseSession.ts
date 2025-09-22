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
  // Supabase expects provider 'oidc' for custom OIDC (Clerk). Force it here to avoid runtime misconfig.
  const envProvider = (process.env.NEXT_PUBLIC_SUPABASE_IDENTITY_PROVIDER as string | undefined);
  const provider = "oidc" as const;
  const enabled = String(process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED || "").toLowerCase() === "true";

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
        if (envProvider && envProvider.toLowerCase() !== "oidc") {
          console.warn(`[SupabaseSession] Overriding NEXT_PUBLIC_SUPABASE_IDENTITY_PROVIDER='${envProvider}' to 'oidc'`);
        }
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
