"use client";

import * as React from "react";
import { fetchRemoteEnvs, initRuntimeConfig, getClerkBaseUrl, getClerkClientId, getClerkHostedUrl, getClerkPublishableKey, getConfigBool, isDesktopMode } from "@/lib/runtime/config";
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
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
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
      await initRuntimeConfig("prod", { withRemoteEnvs: true, override: false });
      configureSupabaseFromRuntime();
      try { diagLog("success", "[Diagnostics] Runtime config initialized"); } catch {}
      setReady(true);
    } catch (e: any) {
      try { diagLog("error", "[Diagnostics] initRuntimeConfig failed", { error: String(e?.message || e) }); } catch {}
      setReady(false);
    }
  }, []);

  const loadRemoteEnvs = React.useCallback(async () => {
    try {
      const items = await fetchRemoteEnvs();
      setEnvs(items);
      const map: Record<string,string> = {};
      for (const it of items) {
        const k = String(it?.key || "").trim();
        if (!k) continue;
        map[k] = String((it as any)?.value ?? "");
      }
      setEnvMap(map);
      try { diagLog("info", "[Diagnostics] Loaded remote envs", { count: items.length }); } catch {}
    } catch (e: any) {
      try { diagLog("error", "[Diagnostics] fetchRemoteEnvs failed", { error: String(e?.message || e) }); } catch {}
    }
  }, []);

  const runWellKnown = React.useCallback(async () => {
    try {
      const base = getClerkBaseUrl();
      const url = `${base.replace(/\/$/, "")}/.well-known/openid-configuration`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      setWellKnown(json);
      try { diagLog("success", "[Diagnostics] Fetched OIDC discovery", { status: res.status }); } catch {}
    } catch (e: any) {
      setWellKnown({ error: String(e?.message || e) });
      try { diagLog("error", "[Diagnostics] OIDC discovery failed", { error: String(e?.message || e) }); } catch {}
    }
  }, []);

  const runSessionCheck = React.useCallback(async () => {
    try {
      const enabled = getConfigBool("SUPABASE_SESSION_ENABLED", false);
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
    const modeDesktop = isDesktopMode();
    const required = [
      { key: "CLERK_PUBLISHABLE_KEY", required: !modeDesktop, why: "Needed to mount ClerkProvider in web mode" },
      { key: "CLERK_CLIENT_ID", required: true, why: "OAuth client_id for PKCE/token exchange" },
      { key: "CLERK_BASE_URL", required: true, why: "OIDC/OAuth base URL" },
      { key: "SUPABASE_URL", required: true, why: "Supabase project URL" },
      { key: "SUPABASE_ANON_KEY", required: true, why: "Supabase anon key for client SDK" },
      { key: "DESKTOP_DISABLE_CLERK", required: true, why: "Determines desktop vs web mode (affects SSR redirect)" },
      { key: "SUPABASE_SESSION_ENABLED", required: false, why: "Optional: enable client session tests" },
      { key: "CLERK_HOSTED_URL", required: false, why: "Optional: hosted sign-in URL for deep link" },
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
          <Row title="Supabase Configured" ok={isSupabaseConfigured} detail={String(isSupabaseConfigured)} reason={isSupabaseConfigured ? "" : "initRuntimeConfig/Client setup ناقص است"} />
          <Row title="Supabase Session" ok={!!sessionInfo?.hasSession} detail={sessionInfo?.hasSession ? "Active" : "None"} reason={sessionInfo?.error} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">اعتبارسنجی کلیدهای محیط (از API)</h2>
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
        <h2 className="text-lg font-medium">فهرست کامل env از API</h2>
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
        <div className="text-xs opacity-70">آدرس: {(() => { try { return `${getClerkBaseUrl().replace(/\/$/, "")}/.well-known/openid-configuration`; } catch { return "-"; } })()}</div>
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
