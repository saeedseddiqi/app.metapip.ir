"use client";

import React from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import { useEventsStream, type EventRow } from "../lib/useEventsStream";
import { formatTime } from "../lib/utils";

export function EventsStream() {
  const [rows, setRows] = React.useState<EventRow[]>([]);
  const [accountId, setAccountId] = React.useState<string>("");
  const [eventType, setEventType] = React.useState<string>("");
  const [limit, setLimit] = React.useState<number>(50);

  const filterParts: string[] = [];
  if (accountId.trim()) filterParts.push(`account_id=eq.${accountId.trim()}`);
  if (eventType.trim()) filterParts.push(`event_type=eq.${eventType.trim()}`);
  const filter = filterParts.join("&");

  const { status, retries } = useEventsStream(
    (row) => {
      setRows((prev) => [row, ...prev].slice(0, limit));
    },
    filter || undefined
  );

  const clear = () => setRows([]);

  const statusColor = (s: string) => {
    switch (s) {
      case "subscribed":
        return "bg-emerald-500";
      case "connecting":
      case "reconnecting":
        return "bg-amber-500 animate-pulse";
      case "error":
      case "closed":
        return "bg-rose-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">رویدادهای Realtime (events_stream)</h2>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 px-2 py-1 rounded border border-gray-200 dark:border-zinc-700">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor(status)}`} aria-label="status-indicator" />
            <span className="text-xs text-gray-700 dark:text-zinc-300">وضعیت: {status}</span>
            {retries > 0 && (
              <span className="text-xs text-gray-500">(تلاش مجدد: {retries})</span>
            )}
          </div>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="account_id"
            className="px-2 py-1 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
            dir="ltr"
          />
          <input
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="event_type (مثلاً account.connected)"
            className="px-2 py-1 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
            dir="ltr"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value || "50", 10))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button onClick={clear} className="px-3 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 rounded">پاک کردن</button>
        </div>
      </div>

      {!isSupabaseConfigured ? (
        <div className="p-3 rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          متغیرهای NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY پیکربندی نشده‌اند؛ اتصال Realtime غیرفعال است.
        </div>
      ) : null}

      <div className="h-64 overflow-auto rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-sm font-mono" dir="ltr">
        {rows.length === 0 ? (
          <div className="text-gray-600 dark:text-zinc-300">هنوز رویدادی دریافت نشده است.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="border-b border-gray-200 dark:border-zinc-700 pb-2">
                <div className="text-xs text-gray-500">[{formatTime(new Date(r.created_at))}]</div>
                <div className="font-semibold">{r.event_type}</div>
                {typeof r.account_id !== "undefined" && (
                  <div className="text-xs text-gray-600">account_id: {String(r.account_id ?? "-")}</div>
                )}
                {typeof r.server !== "undefined" && r.server && (
                  <div className="text-xs text-gray-600">server: {r.server}</div>
                )}
                <pre className="text-xs whitespace-pre-wrap select-text">{JSON.stringify(r.data, null, 2)}</pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
