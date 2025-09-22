"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export type JournalTradeRow = {
  id: number;
  ticket: number;
  user_id?: string | null;
  account_id: number | null;
  symbol: string;
  type: string | null; // buy/sell
  order_kind: string | null; // market/limit/stop
  order_type_const?: string | null;
  open_time_utc?: string | null;
  close_time_utc?: string | null;
  result?: string | null; // win/loss/breakeven
  profit?: number | null;
  profit_net?: number | null;
  rr_ratio?: number | null;
  risk_percent?: number | null;
  entry_screenshot_url?: string | null;
  exit_screenshot_url?: string | null;
};

type SortState = { column: keyof JournalTradeRow; dir: "asc" | "desc" } | null;

export default function TradesJournalTable() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<JournalTradeRow[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // filters
  const [symbol, setSymbol] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [orderKind, setOrderKind] = useState<string>("");
  const [openFrom, setOpenFrom] = useState<string>("");
  const [openTo, setOpenTo] = useState<string>("");
  const [closeFrom, setCloseFrom] = useState<string>("");
  const [closeTo, setCloseTo] = useState<string>("");
  const [sort, setSort] = useState<SortState>({ column: "close_time_utc", dir: "desc" } as any);
  const [groupByTicket, setGroupByTicket] = useState<boolean>(false);

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
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!canQuery) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchTrades = async () => {
      setLoading(true);
      setError(null);
      try {
        let q = supabase
          .from("journal_trades_v")
          .select(
            "id, ticket, user_id, account_id, symbol, type, order_kind, order_type_const, open_time_utc, close_time_utc, result, profit, profit_net, rr_ratio, risk_percent, entry_screenshot_url, exit_screenshot_url"
          )
          .eq("user_id", userId!);

        if (symbol.trim()) q = q.ilike("symbol", `%${symbol.trim()}%`);
        if (result) q = q.eq("result", result);
        if (type) q = q.eq("type", type);
        if (orderKind) q = q.eq("order_kind", orderKind);
        if (openFrom) q = q.gte("open_time_utc", toISODateStart(openFrom));
        if (openTo) q = q.lte("open_time_utc", toISODateEnd(openTo));
        if (closeFrom) q = q.gte("close_time_utc", toISODateStart(closeFrom));
        if (closeTo) q = q.lte("close_time_utc", toISODateEnd(closeTo));

        if (sort) {
          q = q.order(sort.column as string, { ascending: sort.dir === "asc" });
        } else {
          q = q.order("close_time_utc", { ascending: false });
        }

        const { data, error } = await q;
        if (error) throw error;
        if (!cancelled) setRows((data as JournalTradeRow[]) || []);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTrades();

    // Realtime for trades: subscribe to base table and refetch
    const channel = supabase
      .channel("public:trades")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trades" },
        () => {
          fetchTrades();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trades" },
        () => {
          fetchTrades();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [canQuery, userId, symbol, result, type, orderKind, openFrom, openTo, closeFrom, closeTo, sort?.column, sort?.dir]);

  const onSort = (column: keyof JournalTradeRow) => {
    setSort((prev) => {
      if (!prev || prev.column !== column) return { column, dir: "desc" } as any;
      return { column, dir: prev.dir === "desc" ? "asc" : "desc" } as any;
    });
  };

  const displayRows = useMemo(() => {
    if (!groupByTicket) return rows;
    // Group by (user_id, account_id, ticket) and keep the latest close_time_utc (or created order)
    const map = new Map<string, JournalTradeRow>();
    for (const r of rows || []) {
      const key = `${r.user_id || "-"}:${r.account_id ?? "-"}:${r.ticket}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, r);
        continue;
      }
      const prevClose = prev.close_time_utc ? new Date(prev.close_time_utc).getTime() : -Infinity;
      const curClose = r.close_time_utc ? new Date(r.close_time_utc).getTime() : -Infinity;
      if (curClose >= prevClose) {
        map.set(key, r);
      }
    }
    return Array.from(map.values());
  }, [rows, groupByTicket]);

  const renderBody = () => {
    if (!isSupabaseConfigured) {
      return (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          Supabase پیکربندی نشده است. لطفاً متغیرهای محیطی NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY را تنظیم کنید.
        </div>
      );
    }
    if (!userId) {
      return <div className="text-sm text-gray-600 dark:text-zinc-300">برای مشاهده ابتدا وارد شوید یا اکانت را لینک کنید.</div>;
    }
    if (loading) return <div className="text-sm">در حال بارگذاری…</div>;
    if (error) return <div className="text-sm text-red-600">خطا: {error}</div>;
    if (!displayRows?.length) return <div className="text-sm text-gray-600 dark:text-zinc-300">هیچ تریدی یافت نشد.</div>;

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-200 dark:border-zinc-700 rounded-md overflow-hidden">
          <thead className="bg-gray-100 dark:bg-zinc-800">
            <tr>
              <Th onClick={() => onSort("ticket")}>تیکت</Th>
              <Th onClick={() => onSort("account_id")}>اکانت</Th>
              <Th onClick={() => onSort("symbol")}>نماد</Th>
              <Th onClick={() => onSort("type")}>نوع</Th>
              <Th onClick={() => onSort("order_kind")}>نوع اردر</Th>
              <Th onClick={() => onSort("result")}>نتیجه</Th>
              <Th onClick={() => onSort("open_time_utc")}>تاریخ باز</Th>
              <Th onClick={() => onSort("close_time_utc")}>تاریخ بسته</Th>
              <Th onClick={() => onSort("profit_net")}>سود خالص</Th>
              <th className="p-2 text-right">ورود</th>
              <th className="p-2 text-right">خروج</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r) => (
              <tr key={r.id} className="border-t border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                <td className="p-2 font-mono">{r.ticket}</td>
                <td className="p-2">{r.account_id ?? "-"}</td>
                <td className="p-2">{fmtSymbol(r.symbol)}</td>
                <td className="p-2">{r.type?.toUpperCase() || "-"}</td>
                <td className="p-2">{fmtOrderKind(r.order_kind)}</td>
                <td className="p-2">{fmtResult(r.result)}</td>
                <td className="p-2">{fmtDate(r.open_time_utc)}</td>
                <td className="p-2">{fmtDate(r.close_time_utc)}</td>
                <td className="p-2">{fmtNum(r.profit_net)}</td>
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
                    <span className="text-xs text-gray-500">-</span>
                  )}
                </td>
                <td className="p-2">
                  {r.exit_screenshot_url ? (
                    <button
                      onClick={() => setPreviewUrl(r.exit_screenshot_url as string)}
                      className="px-2 py-1 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                      title="نمایش اسکرین‌شات خروج"
                    >
                      مشاهده
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">-</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <input
          value={symbol}
          onChange={(e) => {
            const v = (e.target.value || "").toUpperCase().replace(/\.+$/, "");
            setSymbol(v);
          }}
          placeholder="نماد (مثل: XAUUSD)"
          className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
        />
        <select value={result} onChange={(e) => setResult(e.target.value)} className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800">
          <option value="">نتیجه (همه)</option>
          <option value="win">برد</option>
          <option value="loss">باخت</option>
          <option value="breakeven">سربه‌سر</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800">
          <option value="">نوع ترید (همه)</option>
          <option value="buy">BUY</option>
          <option value="sell">SELL</option>
        </select>
        <select value={orderKind} onChange={(e) => setOrderKind(e.target.value)} className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800">
          <option value="">نوع اردر (همه)</option>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
        </select>
        <input type="date" value={openFrom} onChange={(e) => setOpenFrom(e.target.value)} className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
        <input type="date" value={openTo} onChange={(e) => setOpenTo(e.target.value)} className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
        <input type="date" value={closeFrom} onChange={(e) => setCloseFrom(e.target.value)} className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
        <input type="date" value={closeTo} onChange={(e) => setCloseTo(e.target.value)} className="px-2 py-1 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={groupByTicket} onChange={(e) => setGroupByTicket(e.target.checked)} />
          <span>گروه‌بندی بر اساس تیکت</span>
        </label>
        <button
          onClick={() => {
            setSymbol("");
            setResult("");
            setType("");
            setOrderKind("");
            setOpenFrom("");
            setOpenTo("");
            setCloseFrom("");
            setCloseTo("");
            setSort({ column: "close_time_utc", dir: "desc" } as any);
            setGroupByTicket(false);
          }}
          className="px-3 py-1.5 rounded-md text-sm bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100"
        >
          ریست فیلترها
        </button>
      </div>
      <div className="text-xs text-gray-500 dark:text-zinc-400">تعداد ردیف‌ها: {rows.length}{groupByTicket ? ` (پس از گروه‌بندی: ${displayRows.length})` : ""}</div>

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

function Th({ children, onClick }: { children: any; onClick?: () => void }) {
  return (
    <th className="p-2 text-right cursor-pointer select-none" onClick={onClick}>
      {children}
    </th>
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
    return iso as any;
  }
}

function fmtResult(r?: string | null) {
  const v = (r || "").toLowerCase();
  if (!v) return "-";
  if (v === "win") return "برد";
  if (v === "loss") return "باخت";
  if (v === "breakeven") return "سربه‌سر";
  return v;
}

function fmtOrderKind(v?: string | null) {
  const x = (v || "").toLowerCase();
  if (!x) return "-";
  if (x === "market") return "Market";
  if (x === "limit") return "Limit";
  if (x === "stop") return "Stop";
  return x;
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

function toISODateStart(d: string) {
  try {
    return new Date(d + "T00:00:00Z").toISOString();
  } catch {
    return d;
  }
}
function toISODateEnd(d: string) {
  try {
    return new Date(d + "T23:59:59Z").toISOString();
  } catch {
    return d;
  }
}
