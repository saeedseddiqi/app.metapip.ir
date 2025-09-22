"use client";

import * as React from "react";
import { supabase, isSupabaseConfigured, configureSupabaseFromRuntime } from "@/lib/supabase";
import { add as diagLog, subscribe as diagSubscribe, getAll as diagGetAll, clear as diagClear, DiagLog } from "@/lib/diagnostics/logger";
import { openHostedSignIn } from "@/lib/auth/deepLink";

export type RemoteEnvItem = { key: string; value: string; is_secret?: boolean | null };

function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>{ok ? "OK" : "FAIL"}</span>
  );
}

function Row({ title, ok, detail, reason }: { title: string; ok: boolean; detail?: React.ReactNode; reason?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-2 p-2 border-t border-gray-200 dark:border-zinc-800 text-sm">
      <div className="col-span-3 font-medium">{title}</div>
      <div className="col-span-2"><Badge ok={ok} /></div>
      <div className="col-span-4 break-all">{detail ?? "-"}</div>
      <div className="col-span-3 text-red-600 dark:text-red-400 text-xs">{ok ? "" : (reason ?? "-")}</div>
    </div>
  );
}

export function DiagnosticsPanel() {
  const [envs, setEnvs] = React.useState<RemoteEnvItem[]>([]);
  const [envMap, setEnvMap] = React.useState<Record<string,string>>({});
  const [logs, setLogs] = React.useState<DiagLog[]>(() => diagGetAll());
  const [wellKnown, setWellKnown] = React.useState<any>(null);
  const [sessionInfo, setSessionInfo] = React.useState<{ hasSession: boolean; error?: string } | null>(null);

  React.useEffect(() => {
    const unsub = diagSubscribe((l) => setLogs(l));
    return () => { try { unsub && unsub(); } catch {} };
  }, []);

  const runBootstrap = React.useCallback(async () => {
    try {
      configureSupabaseFromRuntime();
      try { diagLog("success", "[Diagnostics] Supabase from env initialized"); } catch {}
    } catch (e: any) {
      try { diagLog("error", "[Diagnostics] Supabase init failed", { error: String(e?.message || e) }); } catch {}
    }
  }, []);

  const loadRemoteEnvs = React.useCallback(async () => {
    try {
      // Build envs from known NEXT_PUBLIC_* keys (client-only). Next.js inlines these at build time.
      const keys = [
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_CLERK_BASE_URL",
        "NEXT_PUBLIC_CLERK_OAUTH_BASE",
        "NEXT_PUBLIC_CLERK_HOSTED_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_SESSION_ENABLED",
        "NEXT_PUBLIC_DESKTOP_DISABLE_CLERK",
      ] as const;
      const read = (k: (typeof keys)[number]): string | undefined => {
        switch (k) {
          case "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
          case "NEXT_PUBLIC_CLERK_BASE_URL": return process.env.NEXT_PUBLIC_CLERK_BASE_URL;
          case "NEXT_PUBLIC_CLERK_OAUTH_BASE": return process.env.NEXT_PUBLIC_CLERK_OAUTH_BASE as any;
          case "NEXT_PUBLIC_CLERK_HOSTED_URL": return process.env.NEXT_PUBLIC_CLERK_HOSTED_URL as any;
          case "NEXT_PUBLIC_SUPABASE_URL": return process.env.NEXT_PUBLIC_SUPABASE_URL;
          case "NEXT_PUBLIC_SUPABASE_ANON_KEY": return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          case "NEXT_PUBLIC_SUPABASE_SESSION_ENABLED": return process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED as any;
          case "NEXT_PUBLIC_DESKTOP_DISABLE_CLERK": return process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK as any;
        }
      };
      const items: RemoteEnvItem[] = keys.map((k) => ({ key: k, value: String(read(k) ?? ""), is_secret: false }));
      setEnvs(items);
      // Normalize to logical keys without NEXT_PUBLIC_
      const map: Record<string,string> = {};
      const setIfEmpty = (k: string, v?: string) => { if (v && !(k in map)) map[k] = v; };
      for (const it of items) {
        const rawKey = String(it?.key || "").trim();
        const val = String((it as any)?.value ?? "");
        if (!rawKey) continue;
        const tail = rawKey.replace(/^NEXT_PUBLIC_/, "");
        if (tail === "CLERK_BASE_URL" || tail === "CLERK_OAUTH_BASE") setIfEmpty("CLERK_BASE_URL", val);
        else if (tail === "CLERK_PUBLISHABLE_KEY") setIfEmpty("CLERK_PUBLISHABLE_KEY", val);
        else if (tail === "CLERK_HOSTED_URL") setIfEmpty("CLERK_HOSTED_URL", val);
        else if (tail === "SUPABASE_URL") setIfEmpty("SUPABASE_URL", val);
        else if (tail === "SUPABASE_ANON_KEY") setIfEmpty("SUPABASE_ANON_KEY", val);
        else if (tail === "DESKTOP_DISABLE_CLERK") setIfEmpty("DESKTOP_DISABLE_CLERK", val);
        else if (tail === "SUPABASE_SESSION_ENABLED") setIfEmpty("SUPABASE_SESSION_ENABLED", val);
      }
      setEnvMap(map);
      try { diagLog("info", "[Diagnostics] Loaded envs from process.env", { count: items.length }); } catch {}
    } catch (e: any) {
      try { diagLog("error", "[Diagnostics] env read failed", { error: String(e?.message || e) }); } catch {}
    }
  }, []);

  const runWellKnown = React.useCallback(async () => {
    try {
      const base = (process.env.NEXT_PUBLIC_CLERK_BASE_URL as string | undefined) || (process.env.NEXT_PUBLIC_CLERK_OAUTH_BASE as string | undefined);
      if (!base) { setWellKnown({ error: "CLERK_BASE_URL not set" }); return; }
      const url = `/api/oidc-discovery?base=${encodeURIComponent(base)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setWellKnown(json?.data ?? json);
        try { diagLog("success", "[Diagnostics] Fetched OIDC discovery", { status: json?.status ?? res.status }); } catch {}
      } else {
        setWellKnown({ error: json?.error || `HTTP ${res.status}`, status: json?.status ?? res.status });
        try { diagLog("error", "[Diagnostics] OIDC discovery failed", { status: json?.status ?? res.status, error: json?.error || "Unknown" }); } catch {}
      }
    } catch (e: any) {
      setWellKnown({ error: String(e?.message || e) });
      try { diagLog("error", "[Diagnostics] OIDC discovery failed", { error: String(e?.message || e) }); } catch {}
    }
  }, []);

  const runSessionCheck = React.useCallback(async () => {
    try {
      const enabled = (() => {
        const v = String(process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED || "0").trim().toLowerCase();
        return v === "1" || v === "true" || v === "yes";
      })();
      if (!enabled) { setSessionInfo({ hasSession: false, error: "Client session disabled by config" }); return; }
      const { data, error } = await supabase.auth.getSession();
      setSessionInfo({ hasSession: !!data?.session, error: error?.message });
    } catch (e: any) {
      setSessionInfo({ hasSession: false, error: String(e?.message || e) });
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      await runBootstrap();
      await loadRemoteEnvs();
      await runWellKnown();
      await runSessionCheck();
    })();
  }, [runBootstrap, loadRemoteEnvs, runWellKnown, runSessionCheck]);

  const r = React.useMemo(() => {
    const t = String(envMap["DESKTOP_DISABLE_CLERK"] || "0").trim().toLowerCase();
    const modeDesktop = t === "1" || t === "true" || t === "yes";
    const required = [
      { key: "CLERK_PUBLISHABLE_KEY", required: !modeDesktop, why: "Needed to mount ClerkProvider in web mode" },
      { key: "SUPABASE_URL", required: true, why: "Supabase project URL" },
      { key: "SUPABASE_ANON_KEY", required: true, why: "Supabase anon key for client SDK" },
      { key: "DESKTOP_DISABLE_CLERK", required: true, why: "Determines desktop vs web mode (affects SSR redirect)" },
      { key: "SUPABASE_SESSION_ENABLED", required: false, why: "Optional: enable client session tests" },
    ];
    const entries = required.map((req) => {
      const v = envMap[req.key];
      const present = typeof v === "string" && v.trim().length > 0;
      let ok = present || !req.required;
      let reason = "";
      if (req.required && !present) {
        reason = "Missing required key";
      }
      if (req.key.endsWith("URL") && present) {
        try { new URL(v); } catch { ok = false; reason = "Invalid URL format"; }
      }
      if (req.key === "DESKTOP_DISABLE_CLERK" && present) {
        const t = v.trim().toLowerCase();
        if (!["0","1","true","false","yes","no"].includes(t)) { ok = false; reason = "Expected 0/1 or true/false"; }
      }
      return { key: req.key, ok, value: v, reason, why: req.why };
    });

    const clerkWebReady = !modeDesktop && !!envMap["CLERK_PUBLISHABLE_KEY"]; 
    const ssrRedirectExpected = !modeDesktop; // middleware enforces redirect when not desktop

    return { modeDesktop, entries, clerkWebReady, ssrRedirectExpected };
  }, [envMap]);

  const summary = React.useMemo(() => {
    const maskUrl = (u: string) => {
      try { const o = new URL(u); return `${o.protocol}//${o.hostname}`; } catch { return u ? "(invalid url)" : ""; }
    };
    const clerk = envMap["CLERK_PUBLISHABLE_KEY"] || "";
    const clerkBase = envMap["CLERK_BASE_URL"] || "";
    const clerkBaseValid = (() => { try { new URL(clerkBase); return true; } catch { return false; } })();
    const supaUrl = envMap["SUPABASE_URL"] || "";
    const anon = envMap["SUPABASE_ANON_KEY"] || "";
    const desktop = envMap["DESKTOP_DISABLE_CLERK"] || "0";
    const sess = envMap["SUPABASE_SESSION_ENABLED"] || "0";
    return {
      clerkPresent: !!clerk,
      clerkPreview: clerk ? `${clerk.slice(0, 8)}…` : "",
      clerkBasePresent: !!clerkBase,
      clerkBaseValid,
      clerkBaseValue: clerkBase,
      supabaseUrlPresent: !!supaUrl,
      supabaseUrlMasked: supaUrl ? maskUrl(supaUrl) : "",
      anonPresent: !!anon,
      desktopFlag: desktop,
      sessionEnabledFlag: sess,
    };
  }, [envMap]);

  const onOpenLogin = async () => { try { await openHostedSignIn("metapip://auth/callback"); } catch {} };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">عیب‌یابی و تست</h1>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={onOpenLogin}>باز کردن ورود (PKCE)</button>
          <button className="px-3 py-2 rounded bg-gray-700 text-white" onClick={() => { try { diagClear(); } catch {} }}>پاک کردن لاگ‌ها</button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">وضعیت کلی</h2>
        <div className="rounded border border-gray-200 dark:border-zinc-800">
          <Row title="حالت دسکتاپ" ok={r.modeDesktop} detail={String(r.modeDesktop)} reason={!r.modeDesktop ? "" : "در دسکتاپ ریدایرکت سروری غیرفعال است"} />
          <Row title="Clerk Web Ready" ok={r.clerkWebReady} detail={r.clerkWebReady ? "Provider will mount" : "Missing PUBLISHABLE_KEY or desktop mode"} reason={r.clerkWebReady ? "" : "اگر وب می‌خواهید، DESKTOP_DISABLE_CLERK=0 و CLERK_PUBLISHABLE_KEY لازم است"} />
          <Row title="SSR Redirect Expected" ok={r.ssrRedirectExpected} detail={r.ssrRedirectExpected ? "Yes (/→/sign-in)" : "No (desktop mode)"} />
          <Row title="Supabase Configured" ok={isSupabaseConfigured} detail={String(isSupabaseConfigured)} reason={isSupabaseConfigured ? "" : "Env keys or client setup is incomplete"} />
          <Row title="Supabase Session" ok={!!sessionInfo?.hasSession} detail={sessionInfo?.hasSession ? "Active" : "None"} reason={sessionInfo?.error} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">خلاصه متغیرهای درخواستی</h2>
        <div className="rounded border border-gray-200 dark:border-zinc-800 p-3 text-sm">
          <div className="space-y-1">
            <div><span className="font-medium">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:</span> {summary.clerkPresent ? <span className="text-emerald-600">present</span> : <span className="text-red-600">missing</span>} {summary.clerkPreview && <span className="ml-2 opacity-80">({summary.clerkPreview})</span>}</div>
            <div>
              <span className="font-medium">CLERK_BASE_URL (from NEXT_PUBLIC_CLERK_BASE_URL / NEXT_PUBLIC_CLERK_OAUTH_BASE):</span>
              {" "}
              {summary.clerkBasePresent ? <span className="text-emerald-600">present</span> : <span className="text-red-600">missing</span>}
              {summary.clerkBaseValue && (
                <span className="ml-2 opacity-80 select-all">({summary.clerkBaseValue})</span>
              )}
              {summary.clerkBasePresent && !summary.clerkBaseValid && (
                <span className="ml-2 text-red-600">invalid URL</span>
              )}
            </div>
            <div><span className="font-medium">NEXT_PUBLIC_SUPABASE_URL (masked):</span> {summary.supabaseUrlPresent ? <span className="opacity-80 select-all">{summary.supabaseUrlMasked}</span> : <span className="text-red-600">missing</span>}</div>
            <div><span className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span> {summary.anonPresent ? <span className="text-emerald-600">present</span> : <span className="text-red-600">missing</span>}</div>
            <div><span className="font-medium">NEXT_PUBLIC_DESKTOP_DISABLE_CLERK:</span> <span className="opacity-80">{summary.desktopFlag || "0"}</span></div>
            <div><span className="font-medium">NEXT_PUBLIC_SUPABASE_SESSION_ENABLED:</span> <span className="opacity-80">{summary.sessionEnabledFlag || "0"}</span></div>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">اعتبارسنجی کلیدهای محیط (از env)</h2>
        <div className="rounded border border-gray-200 dark:border-zinc-800">
          <div className="grid grid-cols-12 gap-2 p-2 bg-gray-50 dark:bg-zinc-900/40 text-xs font-semibold">
            <div className="col-span-3">کلید</div>
            <div className="col-span-2">وضعیت</div>
            <div className="col-span-4">مقدار/جزئیات</div>
            <div className="col-span-3">دلیل/نیاز</div>
          </div>
          {r.entries.map((e) => (
            <div key={e.key} className="grid grid-cols-12 gap-2 p-2 border-t border-gray-200 dark:border-zinc-800 text-sm">
              <div className="col-span-3 font-mono">{e.key}</div>
              <div className="col-span-2"><Badge ok={!!e.ok} /></div>
              <div className="col-span-4 break-all">{e.value ? (e.key.includes("KEY") ? <span className="select-all">{e.value.slice(0,6)}…</span> : e.value) : <i>missing</i>}</div>
              <div className="col-span-3 text-xs">{e.ok ? e.why : (e.reason || e.why)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">فهرست env از process.env</h2>
        <div className="overflow-auto rounded border border-gray-200 dark:border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-900/50">
              <tr>
                <th className="text-right p-2">کلید</th>
                <th className="text-right p-2">مقدار</th>
                <th className="text-right p-2">secret?</th>
              </tr>
            </thead>
            <tbody>
              {envs.map((it) => (
                <tr key={it.key} className="border-t border-gray-100 dark:border-zinc-800">
                  <td className="p-2 font-mono">{it.key}</td>
                  <td className="p-2 break-all">{it.is_secret ? <span>***</span> : (it.value || <i>empty</i>)}</td>
                  <td className="p-2 text-xs">{String(!!it.is_secret)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">OIDC Discovery</h2>
        <div className="text-xs opacity-70">آدرس: {(() => { try { const base = (process.env.NEXT_PUBLIC_CLERK_BASE_URL as string | undefined) || (process.env.NEXT_PUBLIC_CLERK_OAUTH_BASE as string | undefined); return base ? `${base.replace(/\/$/, "")}/.well-known/openid-configuration` : "-"; } catch { return "-"; } })()}</div>
        <pre className="text-xs overflow-auto p-2 rounded bg-gray-50 dark:bg-zinc-900/30">{JSON.stringify(wellKnown, null, 2)}</pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">لاگ‌ها</h2>
        <div className="max-h-[40vh] overflow-auto rounded border border-gray-200 dark:border-zinc-800 p-2 bg-white dark:bg-zinc-900 text-xs space-y-1">
          {logs.length === 0 && <div className="opacity-70">لاگی ثبت نشده است.</div>}
          {logs.map((l) => (
            <div key={l.id} className="flex gap-2 items-start">
              <span className="opacity-60 whitespace-nowrap">{new Date(l.ts).toLocaleTimeString()}</span>
              <span className={`font-semibold ${l.level === "error" ? "text-red-600" : l.level === "warn" ? "text-amber-600" : l.level === "success" ? "text-emerald-600" : "text-gray-600"}`}>{l.level.toUpperCase()}</span>
              <span>{l.message}</span>
              {l.data && <pre className="ml-auto opacity-70 overflow-auto max-w-[50%]">{JSON.stringify(l.data, null, 2)}</pre>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default DiagnosticsPanel;
