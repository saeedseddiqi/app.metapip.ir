import React from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export const Settings: React.FC = () => {
  const [notifications, setNotifications] = React.useState(true);
  const [autoStart, setAutoStart] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [vw, setVw] = React.useState<number>(1366);
  const [vh, setVh] = React.useState<number>(768);
  const [saving, setSaving] = React.useState<boolean>(false);

  // --- Updater state ---
  const [isTauri, setIsTauri] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [currentVersion, setCurrentVersion] = React.useState<string>("");
  const [updateAvailable, setUpdateAvailable] = React.useState<boolean | null>(null);
  const [latestVersion, setLatestVersion] = React.useState<string>("");
  const [updateNotes, setUpdateNotes] = React.useState<string>("");
  const [downloadAndInstall, setDownloadAndInstall] = React.useState<null | (() => Promise<void>)>(null);
  const [logs, setLogs] = React.useState<string[]>([]);

  const viewportOptions = [
    { label: "1280 × 720 (HD)", w: 1280, h: 720 },
    { label: "1366 × 768 (HD+)", w: 1366, h: 768 },
    { label: "1440 × 900 (WXGA+)", w: 1440, h: 900 },
    { label: "1600 × 900 (HD+ wide)", w: 1600, h: 900 },
    { label: "1920 × 1080 (FHD)", w: 1920, h: 1080 },
    { label: "2560 × 1440 (QHD)", w: 2560, h: 1440 },
    { label: "3840 × 2160 (4K)", w: 3840, h: 2160 },
  ];

  // Theme is controlled globally from header ThemeToggle.

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id as string | undefined;
      if (!mounted) return;
      if (uid) {
        setUserId(uid);
        // load user_settings if exists
        let row: any = null;
        try {
          const { data: r1 }: any = await (isSupabaseConfigured
            ? supabase.from("user_settings").select("viewport_width,viewport_height").eq("user_id", uid).maybeSingle()
            : { data: null });
          row = r1;
        } catch {
          // fallback to single if maybeSingle not available
        }
        if (!row && isSupabaseConfigured) {
          const { data: row2 } = await supabase
            .from("user_settings")
            .select("viewport_width,viewport_height")
            .eq("user_id", uid)
            .single();
          if (row2 && typeof row2.viewport_width === "number" && typeof row2.viewport_height === "number") {
            setVw(row2.viewport_width);
            setVh(row2.viewport_height);
          }
          // theme is ignored here to avoid overriding header toggle
        } else {
          if (row) {
            if (typeof row.viewport_width === "number" && typeof row.viewport_height === "number") {
              setVw(row.viewport_width);
              setVh(row.viewport_height);
            }
            // ignore theme in settings
          }
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Detect Tauri and load current version if available
  React.useEffect(() => {
    const _isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
    setIsTauri(_isTauri);
    if (_isTauri) {
      (async () => {
        try {
          const { getVersion } = await import("@tauri-apps/api/app");
          const v = await getVersion();
          setCurrentVersion(v);
        } catch {}
      })();
    }
  }, []);

  const onViewportChange = async (val: string) => {
    const [wStr, hStr] = val.split("x");
    const w = parseInt(wStr, 10);
    const h = parseInt(hStr, 10);
    if (!userId || !w || !h) return;
    setSaving(true);
    try {
      setVw(w); setVh(h);
      if (isSupabaseConfigured) {
        // Upsert by user_id
        const payload = { user_id: userId, viewport_width: w, viewport_height: h } as any;
        const anyClient: any = supabase;
        if (typeof anyClient.from("user_settings").upsert === "function") {
          await anyClient.from("user_settings").upsert(payload, { onConflict: "user_id" });
        } else {
          // fallback: update then insert
          const { error: upErr } = await supabase.from("user_settings").update(payload).eq("user_id", userId);
          if (upErr) {
            await supabase.from("user_settings").insert(payload);
          }
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Updater handlers
  const appendLog = (line: string) => setLogs((prev) => [...prev.slice(-99), line]);

  const onCheckUpdate = async () => {
    if (!isTauri) {
      appendLog("Tauri در دسترس نیست (احتمالاً در مرورگر/Dev)");
      return;
    }
    setChecking(true);
    setUpdateAvailable(null);
    setLatestVersion("");
    setUpdateNotes("");
    setDownloadAndInstall(null);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      appendLog("در حال بررسی آپدیت...");
      const result: any = await check();
      if (result?.available) {
        const ver = result?.manifest?.version || "";
        const notes = result?.manifest?.notes || result?.manifest?.body || "";
        setUpdateAvailable(true);
        setLatestVersion(ver);
        setUpdateNotes(notes);
        if (typeof result.downloadAndInstall === "function") {
          setDownloadAndInstall(() => result.downloadAndInstall);
        }
        appendLog(`آپدیت موجود است → v${ver}`);
      } else {
        setUpdateAvailable(false);
        appendLog("آپدیتی در دسترس نیست.");
      }
    } catch (e: any) {
      appendLog(`خطا در بررسی آپدیت: ${e?.message || e}`);
    } finally {
      setChecking(false);
    }
  };

  const onInstallUpdate = async () => {
    if (!downloadAndInstall) return;
    try {
      appendLog("دانلود و نصب آپدیت...");
      await downloadAndInstall();
      appendLog("آپدیت نصب شد. برنامه ممکن است نیاز به ری‌استارت داشته باشد.");
    } catch (e: any) {
      appendLog(`خطا در نصب: ${e?.message || e}`);
    }
  };

  // Removed theme persistence & toggle from settings to avoid conflicts.

  return (
    <div dir="rtl" className="space-y-4 p-4 rounded border border-gray-200 dark:border-zinc-700 text-right bg-white dark:bg-zinc-900 card-surface">
      <h2 className="text-xl font-semibold">تنظیمات</h2>
      <div className="text-sm text-gray-600 dark:text-zinc-300">ذخیره‌سازی خودکار بعد از تغییر</div>

      <div className="space-y-3">
        {/* Theme toggle moved to header; removed from settings */}

        <label className="flex flex-row-reverse items-center gap-3">
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
          />
          <span>اعلان‌ها</span>
        </label>

        <label className="flex flex-row-reverse items-center gap-3">
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
          />
          <span>اجرا خودکار با ویندوز</span>
        </label>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="block text-sm mb-1">اندازه اسکرین‌شات (Viewport)</label>
          <select
            className="border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right"
            value={`${vw}x${vh}`}
            onChange={(e) => onViewportChange(e.target.value)}
            disabled={!userId || saving}
          >
            {viewportOptions.map((o) => (
              <option key={`${o.w}x${o.h}`} value={`${o.w}x${o.h}`}>{o.label}</option>
            ))}
          </select>
          {saving && <div className="text-xs text-gray-500 mt-1">در حال ذخیره…</div>}
        </div>

        {/* Updater Section */}
        <div className="mt-4 p-3 border rounded bg-gray-50 dark:bg-zinc-800/50 dark:border-zinc-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">به‌روزرسانی برنامه (Tauri Updater)</h3>
            {isTauri ? (
              <span className="text-xs text-green-700 dark:text-green-400">Tauri فعال</span>
            ) : (
              <span className="text-xs text-gray-500">خارج از Tauri</span>
            )}
          </div>
          <div className="text-sm mb-2">
            نسخه فعلی: <span className="font-mono">{currentVersion || 'نامشخص'}</span>
          </div>
          <div className="flex gap-2 mb-2">
            <button
              onClick={onCheckUpdate}
              disabled={!isTauri || checking}
              className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
            >
              {checking ? 'در حال بررسی…' : 'بررسی آپدیت'}
            </button>
            {updateAvailable && downloadAndInstall && (
              <button
                onClick={onInstallUpdate}
                className="px-3 py-1 rounded bg-emerald-600 text-white"
              >
                دانلود و نصب
              </button>
            )}
          </div>
          {updateAvailable !== null && (
            <div className="text-sm mb-2">
              {updateAvailable ? (
                <>
                  <div>نسخه جدید موجود است: <span className="font-mono">v{latestVersion}</span></div>
                  {updateNotes && <div className="mt-1 whitespace-pre-wrap text-xs opacity-80">{updateNotes}</div>}
                  <div className="text-xs text-gray-600 mt-1">اگر دیالوگ آپدیت به‌صورت خودکار نمایش داده نشد، از دکمه بالا برای نصب استفاده کنید.</div>
                </>
              ) : (
                <div>در حال حاضر آپدیتی موجود نیست.</div>
              )}
            </div>
          )}
          <div className="text-xs font-mono p-2 bg-black/80 text-green-200 rounded max-h-40 overflow-auto">
            {logs.length === 0 ? <div className="opacity-60">لاگی برای نمایش وجود ندارد.</div> : logs.map((l, i) => (
              <div key={i}>• {l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
