"use client";

import * as React from "react";
import { SignedIn, SignedOut, useAuth } from "@clerk/nextjs";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useClerkSupabaseSession } from "@/lib/auth/useClerkSupabaseSession";

export default function TestAuthPage() {
  useClerkSupabaseSession();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [logs, setLogs] = React.useState<string[]>([]);
  const [testing, setTesting] = React.useState(false);
  const sessionEnabled = (() => {
    const v = String(process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();

  const log = React.useCallback((m: string) => setLogs((x) => [m, ...x].slice(0, 200)), []);

  const run = React.useCallback(async () => {
    setTesting(true);
    setLogs([]);
    try {
      if (!isLoaded || !isSignedIn) throw new Error("Clerk not signed in");
      if (!isSupabaseConfigured) throw new Error("Supabase client not configured (.env)");

      // 1) Clerk token
      let token = await getToken?.({ template: "supabase" } as any);
      if (!token) token = await (getToken?.({ template: "session" } as any) as Promise<string | null>);
      if (!token) throw new Error("No Clerk JWT");
      log("✅ Clerk token acquired");

      if (sessionEnabled) {
        // 2) Supabase session
        const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionRes.session) throw sessionErr || new Error("No Supabase session");
        log("✅ Supabase client session active");

        // 3) RLS test
        const { data: rows, error } = await supabase.from("devices").select("*").limit(5);
        if (error) throw error;
        log(`✅ RLS devices select ok (${rows?.length ?? 0} rows)`);
      } else {
        log("ℹ️ Client-side Supabase session is disabled (NEXT_PUBLIC_SUPABASE_SESSION_ENABLED!=true). Skipping session/RLS test.");
      }

      // Optional: Storage test (requires bucket + policies)
      // const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
      // if (bErr) throw bErr;
      // log(`✅ Storage listBuckets ok (${(buckets||[]).length} buckets)`);

      log("🎉 All tests passed");
    } catch (e: any) {
      log(`❌ ${e?.message || String(e)}`);
    } finally {
      setTesting(false);
    }
  }, [isLoaded, isSignedIn, getToken, log]);

  // Removed legacy verify_clerk_jwt flow

  return (
    <div className="space-y-4" dir="rtl">
      <SignedIn>
        <div className="flex items-center gap-2">
          <button disabled={testing} onClick={run} className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50">
            {testing ? "در حال تست…" : "اجرای تست Clerk → Supabase"}
          </button>
          {/* Legacy Tauri verify button removed */}
        </div>
        <div className="mt-4 p-3 rounded bg-gray-100 dark:bg-zinc-800 text-sm whitespace-pre-wrap" dir="auto">
          {logs.length === 0 ? "خروجی تست در اینجا نمایش داده می‌شود" : logs.join("\n")}
        </div>
      </SignedIn>
      <SignedOut>
        <div className="p-4 text-sm opacity-80">برای استفاده از این تست، ابتدا وارد حساب شوید.</div>
      </SignedOut>
    </div>
  );
}
