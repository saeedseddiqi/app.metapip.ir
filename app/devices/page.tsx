"use client";

import React from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { SignedIn, SignedOut, useAuth } from "@clerk/nextjs";
import { isDesktopMode } from "@/lib/runtime/config";
import { getDevices } from "@/lib/auth/functions";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

dayjs.extend(relativeTime);

interface DeviceRow {
  id: string;
  device_name: string;
  device_id: string;
  windows_type: string | null;
  ip_address: string | null;
  linked_at: string | null;
  last_seen: string | null;
  status?: string | null;
  realtime?: boolean | null;
}

function DevicesList() {
  const desktopMode = isDesktopMode();
  const auth = desktopMode ? null : useAuth();
  const isLoaded = desktopMode ? true : (auth as any)?.isLoaded;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<DeviceRow[]>([]);
  const ONLINE_WINDOW_SEC = 60; // هر دستگاهی که در این بازه دیده شده باشد، آنلاین محسوب می‌شود
  const channelRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchList = React.useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const { devices } = await getDevices();
      setRows((devices || []) as any);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [isLoaded]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Supabase Realtime: subscribe to devices changes (filtered by current user_id via RLS)
  React.useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        if (!isLoaded || !isSupabaseConfigured) return;
        const { data: ures } = await supabase.auth.getUser();
        const uid = ures?.user?.id;
        if (!uid) return;
        // cleanup previous channel if any
        try { channelRef.current?.unsubscribe(); } catch {}
        const ch = supabase.channel(`devices:${uid}`);
        channelRef.current = ch;
        ch.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'devices', filter: `user_id=eq.${uid}` } as any,
          (payload: any) => {
            setRows((prev) => {
              const copy = [...prev];
              const findIndex = (did: string) => copy.findIndex((r) => r.device_id === did);
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const row = payload.new as DeviceRow;
                const idx = findIndex(row.device_id);
                if (idx === -1) copy.unshift(row);
                else copy[idx] = row;
              } else if (payload.eventType === 'DELETE') {
                const row = payload.old as DeviceRow;
                const idx = findIndex(row.device_id);
                if (idx !== -1) copy.splice(idx, 1);
              }
              return copy;
            });
          }
        );
        ch.subscribe();
        unsub = () => { try { ch.unsubscribe(); } catch {} };
      } catch {}
    })();
    return () => { try { unsub(); } catch {} };
  }, [isLoaded]);

  const isOnline = React.useCallback((r: DeviceRow) => {
    if (r.realtime) return true;
    if (!r.last_seen) return false;
    const diffSec = Math.abs(dayjs().diff(dayjs(r.last_seen), "second"));
    return diffSec <= ONLINE_WINDOW_SEC;
  }, []);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">دستگاه‌ها</h2>
        <button onClick={fetchList} className="px-3 py-2 rounded bg-zinc-800 text-white hover:bg-black disabled:opacity-50" disabled={loading}>
          بروزرسانی
        </button>
      </div>

      {error && (
        <div className="p-3 rounded bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200" dir="auto">{error}</div>
      )}
      {loading && <div>در حال بارگذاری…</div>}

      {!loading && rows.length === 0 && (
        <div className="text-sm text-zinc-500">هیچ دستگاهی ثبت نشده است.</div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 dark:border-zinc-700">
            <thead className="bg-gray-100 dark:bg-zinc-800">
              <tr>
                <th className="px-3 py-2 text-right">وضعیت</th>
                <th className="px-3 py-2 text-right">نام دستگاه</th>
                <th className="px-3 py-2 text-right">Device ID</th>
                <th className="px-3 py-2 text-right">Windows</th>
                <th className="px-3 py-2 text-right">IP</th>
                <th className="px-3 py-2 text-right">آخرین مشاهده</th>
                <th className="px-3 py-2 text-right">Linked</th>
                <th className="px-3 py-2 text-right">Status</th>
                <th className="px-3 py-2 text-right">Realtime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-200 dark:border-zinc-700">
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 text-xs ${isOnline(r) ? "text-emerald-600" : "text-zinc-500"}`}>
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${isOnline(r) ? "bg-emerald-500" : "bg-zinc-400"}`} />
                      {isOnline(r) ? "آنلاین" : "آفلاین"}
                    </span>
                  </td>
                  <td className="px-3 py-2" dir="auto">{r.device_name}</td>
                  <td className="px-3 py-2" dir="auto">{r.device_id}</td>
                  <td className="px-3 py-2" dir="auto">{r.windows_type ?? "-"}</td>
                  <td className="px-3 py-2" dir="ltr">{r.ip_address ?? "-"}</td>
                  <td className="px-3 py-2" dir="auto">{r.last_seen ? dayjs(r.last_seen).fromNow() : "-"}</td>
                  <td className="px-3 py-2" dir="auto">{r.linked_at ? dayjs(r.linked_at).fromNow() : "-"}</td>
                  <td className="px-3 py-2" dir="auto">{r.status ?? "-"}</td>
                  <td className="px-3 py-2" dir="auto">{r.realtime ? "فعال" : "غیرفعال"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DevicesPage() {
  const desktopMode = isDesktopMode();
  if (desktopMode) {
    return <DevicesList />;
  }
  return (
    <>
      <SignedIn>
        <DevicesList />
      </SignedIn>
      <SignedOut>{/* Redirected by middleware */}</SignedOut>
    </>
  );
}
