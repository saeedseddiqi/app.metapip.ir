"use client";

import * as React from "react";
import { supabase, configureSupabaseFromRuntime } from "@/lib/supabase";
import { openHostedSignIn } from "@/lib/auth/deepLink";

function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>{ok ? "OK" : "FAIL"}</span>
  );
}

function Row({ title, ok, detail, reason }: { title: string; ok: boolean; detail?: React.ReactNode; reason?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-2 p-2 border-t border-gray-200 dark:border-zinc-800 text-sm">
      <div className="col-span-4 font-medium">{title}</div>
      <div className="col-span-2"><Badge ok={ok} /></div>
      <div className="col-span-4 break-all">{detail ?? "-"}</div>
      <div className="col-span-2 text-red-600 dark:text-red-400 text-xs">{ok ? "" : (reason ?? "-")}</div>
    </div>
  );
}

export default function DiagnosticsChecklist() {
  // Read required envs (build-time)
  const env = React.useMemo(() => {
    const get = (k: string) => (process.env as any)[k] as string | undefined;
    const base = get("NEXT_PUBLIC_CLERK_BASE_URL") || get("NEXT_PUBLIC_CLERK_OAUTH_BASE") || get("NEXT_PUBLIC_CLERK_HOSTED_URL");
    const clientId = get("NEXT_PUBLIC_CLERK_CLIENT_ID") || get("NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID");
    return {
      SUPABASE_URL: get("NEXT_PUBLIC_SUPABASE_URL"),
      SUPABASE_ANON_KEY: get("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      CLERK_PUBLISHABLE_KEY: get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      CLERK_BASE_URL: base,
      CLERK_CLIENT_ID: clientId,
      DESKTOP_DISABLE_CLERK: get("NEXT_PUBLIC_DESKTOP_DISABLE_CLERK") || "0",
      SUPABASE_SESSION_ENABLED: get("NEXT_PUBLIC_SUPABASE_SESSION_ENABLED") || "0",
    };
  }, []);

  const [supabaseOk, setSupabaseOk] = React.useState<boolean | null>(null);
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        // minimal init from build-time env
        configureSupabaseFromRuntime();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSupabaseOk(true);
        setHasSession(!!data?.session);
      } catch (e: any) {
        setSupabaseOk(false);
        setError(String(e?.message || e));
      }
    })();
  }, []);

  const desktopMode = (() => {
    const t = String(env.DESKTOP_DISABLE_CLERK || "0").trim().toLowerCase();
    return t === "1" || t === "true" || t === "yes";
  })();

  const checks = React.useMemo(() => {
    const list = [
      {
        title: "NEXT_PUBLIC_SUPABASE_URL",
        ok: !!env.SUPABASE_URL,
        detail: env.SUPABASE_URL ? (() => { try { const u = new URL(env.SUPABASE_URL!); return `${u.protocol}//${u.hostname}`; } catch { return "(invalid url)" } })() : "",
        reason: "Supabase project URL"
      },
      {
        title: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        ok: !!env.SUPABASE_ANON_KEY,
        detail: env.SUPABASE_ANON_KEY ? `${env.SUPABASE_ANON_KEY.slice(0, 8)}…` : "",
        reason: "Supabase anon key for client"
      },
      {
        title: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (web mode)",
        ok: desktopMode ? true : !!env.CLERK_PUBLISHABLE_KEY,
        detail: desktopMode ? "desktop" : (env.CLERK_PUBLISHABLE_KEY ? `${env.CLERK_PUBLISHABLE_KEY.slice(0, 8)}…` : ""),
        reason: desktopMode ? "Disabled in desktop" : "Required to mount ClerkProvider"
      },
      {
        title: "CLERK_BASE_URL (one of: BASE_URL / OAUTH_BASE / HOSTED_URL)",
        ok: !!env.CLERK_BASE_URL,
        detail: env.CLERK_BASE_URL || "",
        reason: "OIDC/OAuth base URL"
      },
      {
        title: "CLERK_CLIENT_ID (one of: CLIENT_ID / OAUTH_CLIENT_ID)",
        ok: !!env.CLERK_CLIENT_ID,
        detail: env.CLERK_CLIENT_ID ? `${env.CLERK_CLIENT_ID.slice(0, 8)}…` : "",
        reason: "OAuth PKCE client id"
      },
      {
        title: "NEXT_PUBLIC_DESKTOP_DISABLE_CLERK",
        ok: ["0","1","true","false","yes","no"].includes(String(env.DESKTOP_DISABLE_CLERK).toLowerCase()),
        detail: env.DESKTOP_DISABLE_CLERK,
        reason: "0 for web, 1 for desktop"
      },
      {
        title: "Supabase SDK reachable",
        ok: supabaseOk === true,
        detail: supabaseOk === null ? "checking…" : (supabaseOk ? "ok" : "fail"),
        reason: error || ""
      },
      {
        title: "Supabase Session (optional)",
        ok: hasSession === true,
        detail: hasSession === null ? "checking…" : (hasSession ? "active" : "none"),
        reason: hasSession ? "" : "Sign in to create session"
      },
    ];
    return list;
  }, [env, supabaseOk, hasSession, error, desktopMode]);

  const onOpenLogin = async () => {
    try {
      await openHostedSignIn("metapip://auth/callback");
    } catch {}
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">چک‌لیست عیب‌یابی</h1>
        <button onClick={onOpenLogin} className="px-3 py-2 rounded bg-emerald-600 text-white">باز کردن ورود (PKCE)</button>
      </div>

      <div className="rounded border border-gray-200 dark:border-zinc-800">
        <div className="grid grid-cols-12 gap-2 p-2 bg-gray-50 dark:bg-zinc-900/50 text-xs font-semibold">
          <div className="col-span-4">آیتم</div>
          <div className="col-span-2">وضعیت</div>
          <div className="col-span-4">جزئیات</div>
          <div className="col-span-2">علت/نیاز</div>
        </div>
        {checks.map((c) => (
          <Row key={c.title} title={c.title} ok={!!c.ok} detail={c.detail} reason={c.reason} />
        ))}
      </div>

      <div className="text-xs opacity-70">
        نکته: متغیرهای محیط باید در پنل Vercel با پیشوند <code>NEXT_PUBLIC_</code> تنظیم شوند تا در باندل استاتیک موجود باشند.
      </div>
    </div>
  );
}
