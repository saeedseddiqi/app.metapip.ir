"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// نمایش جدول پوزیشن‌های باز از جدول public.positions
// فیلتر بر اساس user_id کاربر جاری؛ بروزرسانی ریل‌تایم با Supabase Realtime

export type PositionRow = {
  ticket: number;
  account_id: number | null;
  symbol: string;
  type: string | null; // buy/sell
  volume: number | null;
  open_price: number | null;
  current_price?: number | null;
  floating_profit?: number | null;
  sl?: number | null;
  tp?: number | null;
  open_time_utc?: string | null; // timestamptz
  entry_screenshot_url?: string | null;
};

export default function OpenPositionsTable() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PositionRow[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const canQuery = useMemo(() => isSupabaseConfigured && !!userId, [userId]);

  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id ?? null;
        if (!mounted) return;
        setUserId(uid);
      } catch (e: any) {
        if (!mounted) return;
        setError(String(e?.message || e));
      }
    };

    fetchUser();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!canQuery) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchPositions = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("positions")
          .select("ticket, account_id, symbol, type, volume, open_price, current_price, floating_profit, sl, tp, open_time_utc, entry_screenshot_url")
          .eq("user_id", userId!)
          .order("open_time_utc", { ascending: false });
        if (error) throw error;
        if (!cancelled) setRows((data as PositionRow[]) || []);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPositions();

    // Realtime subscription
    const channel = supabase
      .channel("public:positions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "positions" },
        () => {
          // هر تغییری رخ دهد، مجدداً کوئری می‌کنیم (RLS از user_id محافظت می‌کند)
          fetchPositions();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [canQuery, userId]);

  const renderBody = () => {
    if (!isSupabaseConfigured) {
      return (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          Supabase پیکربندی نشده است. لطفاً متغیرهای محیطی NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY را تنظیم کنید.
        </div>
      );
    }
    if (!userId) {
      return (
        <div className="text-sm text-gray-600 dark:text-zinc-300">
          برای مشاهده پوزیشن‌های باز ابتدا وارد شوید یا اکانت را لینک کنید.
        </div>
      );
    }
    if (loading) {
      return <div className="text-sm">در حال بارگذاری…</div>;
    }
    if (error) {
      return <div className="text-sm text-red-600">خطا: {error}</div>;
    }
    if (!rows?.length) {
      return <div className="text-sm text-gray-600 dark:text-zinc-300">هیچ پوزیشن بازی یافت نشد.</div>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200 dark:border-zinc-700 rounded-md overflow-hidden">
          <thead className="bg-gray-100 dark:bg-zinc-800">
            <tr>
              <th className="p-2 text-right">تیکت</th>
              <th className="p-2 text-right">اکانت</th>
              <th className="p-2 text-right">سیمبل</th>
              <th className="p-2 text-right">نوع</th>
              <th className="p-2 text-right">حجم</th>
              <th className="p-2 text-right">قیمت باز</th>
              <th className="p-2 text-right">قیمت جاری</th>
              <th className="p-2 text-right">P/L شناور</th>
              <th className="p-2 text-right">SL</th>
              <th className="p-2 text-right">TP</th>
              <th className="p-2 text-right">زمان باز شدن</th>
              <th className="p-2 text-right">اسکرین‌شات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticket} className="border-t border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                <td className="p-2 font-mono">{r.ticket}</td>
                <td className="p-2">{r.account_id ?? "-"}</td>
                <td className="p-2">{fmtSymbol(r.symbol)}</td>
                <td className="p-2">
                  <span className={r.type === "buy" ? "text-green-600" : r.type === "sell" ? "text-red-600" : ""}>
                    {r.type?.toUpperCase() || "-"}
                  </span>
                </td>
                <td className="p-2">{fmtNum(r.volume)}</td>
                <td className="p-2">{fmtNum(r.open_price)}</td>
                <td className="p-2">{fmtNum(r.current_price)}</td>
                <td className="p-2">{fmtNum(r.floating_profit)}</td>
                <td className="p-2">{fmtNum(r.sl)}</td>
                <td className="p-2">{fmtNum(r.tp)}</td>
                <td className="p-2">{fmtDate(r.open_time_utc)}</td>
                <td className="p-2">
                  {r.entry_screenshot_url ? (
                    <button
                      onClick={() => setPreviewUrl(r.entry_screenshot_url as string)}
                      className="px-2 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      title="نمایش اسکرین‌شات ورود"
                    >
                      مشاهده
                    </button>
                  ) : (
                    <button
                      className="px-2 py-1 text-xs rounded-md bg-gray-300 text-gray-600 cursor-not-allowed"
                      disabled
                      title="هنوز اسکرین‌شات ثبت نشده"
                    >
                      ناموجود
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-3 p-4 border border-gray-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 card-surface">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">پوزیشن‌های باز</h3>
        {userId && (
          <button
            onClick={async () => {
              try {
                const { data } = await supabase.auth.getUser();
                const uid = data?.user?.id;
                if (!uid) return;
                const { data: rows } = await supabase
                  .from("positions")
                  .select("ticket, account_id, symbol, type, volume, open_price, current_price, floating_profit, sl, tp, open_time_utc")
                  .eq("user_id", uid)
                  .order("open_time_utc", { ascending: false });
                setRows((rows as PositionRow[]) || []);
              } catch {}
            }}
            className="px-3 py-1.5 rounded-md text-sm bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100"
          >
            بروزرسانی
          </button>
        )}
      </div>
      {renderBody()}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-w-6xl w-full max-h-[90vh] bg-white dark:bg-zinc-900 rounded-lg overflow-auto card-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-zinc-700">
              <h4 className="text-sm font-medium">پیش‌نمایش اسکرین‌شات</h4>
              <button
                onClick={() => setPreviewUrl(null)}
                className="px-2 py-1 text-xs rounded-md bg-gray-200 dark:bg-zinc-700"
              >
                بستن
              </button>
            </div>
            <div className="p-2">
              {/* eslint-disable @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="screenshot"
                className="w-full h-auto rounded-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtNum(n?: number | null) {
  if (n === null || n === undefined) return "-";
  const v = Number(n);
  if (Number.isNaN(v)) return "-";
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 5 }).format(v);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("fa-IR");
  } catch {
    return iso;
  }
}

function fmtSymbol(s?: string | null) {
  if (!s) return "-";
  try {
    const v = String(s).trim().toUpperCase().replace(/\.+$/, "");
    return v || "-";
  } catch {
    return String(s);
  }
}
