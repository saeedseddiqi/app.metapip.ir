import React from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Table name expected in Supabase
const TABLE = "risk_limits" as const;

export type RiskLimitRow = {
  account_id: number;
  user_id?: string;
  // core fields used in this simplified UI
  risk_calc_mode?: "balance_pct" | "equity_pct" | "fixed_amount" | string | null;
  max_open_risk_pct?: number | null;
  max_daily_drawdown_pct?: number | null;
  max_weekly_drawdown_pct?: number | null;
  max_daily_profit_pct?: number | null;
  max_weekly_profit_pct?: number | null;
  // legacy fields kept for compatibility (not shown in this UI)
  max_risk_per_trade_pct?: number | null;
  max_risk_per_trade_amount?: number | null;
  virtual_sl_pips?: number | null;
  rr_ratio?: number | null;
  tp_policy?: "rr" | "pips" | string | null;
  tp_fixed_pips?: number | null;
  tp_override_policy?: "respect" | "override" | "log" | string | null;
  sltp_block_policy?: "rollback" | "allow" | string | null;
  enforce_disconnect_on_lock?: boolean | null;
  log_autoclose_on_lock?: boolean | null;
};

const emptyRow = (uid: string | null): RiskLimitRow => ({
  account_id: 0,
  user_id: uid || undefined,
  risk_calc_mode: "day_start_balance",
  max_open_risk_pct: null,
  max_daily_drawdown_pct: null,
  max_weekly_drawdown_pct: null,
  max_daily_profit_pct: null,
  max_weekly_profit_pct: null,
  // legacy defaults
  max_risk_per_trade_pct: 1.0,
  max_risk_per_trade_amount: null,
  virtual_sl_pips: null,
  rr_ratio: 2.0,
  tp_policy: "rr",
  tp_fixed_pips: null,
  tp_override_policy: "respect",
  sltp_block_policy: "rollback",
  enforce_disconnect_on_lock: false,
  log_autoclose_on_lock: true,
});

export const RiskSettings: React.FC = () => {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<RiskLimitRow[]>([]);
  const [accounts, setAccounts] = React.useState<number[]>([]);
  const [selectedAccount, setSelectedAccount] = React.useState<number | "">("");
  const [, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newItem, setNewItem] = React.useState<RiskLimitRow>(emptyRow(null));
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [accStatus, setAccStatus] = React.useState<{ initial?: number | null; daystart?: number | null; base?: number | null } | null>(null);
  const [errorMeta, setErrorMeta] = React.useState<{ table?: string; column?: string; relation?: string; code?: string } | null>(null);
  const [editInitial, setEditInitial] = React.useState<string>("");

  // Normalize Supabase/DB error messages into concise Persian messages
  function formatError(err: any): string {
    const raw = String((err && (err.message || err.error || err.msg)) || err || "خطای ناشناخته");
    const s = raw.toLowerCase();
    // common patterns
    if (/column\s+.+\s+does\s+not\s+exist/.test(s)) return "ستونی که به آن اشاره شده وجود ندارد (column not found).";
    if (/relation\s+.+\s+does\s+not\s+exist/.test(s)) return "جدول/نما پیدا نشد (relation not found).";
    if (/permission\s+denied/.test(s)) return "مجوز دسترسی کافی نیست (احتمالاً RLS یا سطح دسترسی).";
    if (/row\s+level\s+security|rls/.test(s)) return "سیاست‌های RLS مانع دسترسی شده‌اند.";
    if (/failed\s+to\s+fetch|networkerror|network\s+error/.test(s)) return "عدم ارتباط با سرور Supabase (مشکل شبکه).";
    if (/invalid\s+authentication|jwt|auth/.test(s)) return "مشکل احراز هویت با Supabase؛ لطفاً دوباره وارد شوید.";
    return raw;
  }

  // Extract table/column/relation/code for precise debugging
  function parseDbError(err: any): { table?: string; column?: string; relation?: string; code?: string } {
    const meta: { table?: string; column?: string; relation?: string; code?: string } = {};
    try {
      const code = (err && (err.code || err.status || err.error_code)) as string | undefined;
      if (code) meta.code = String(code);
      const raw = String((err && (err.message || err.error || err.msg || err.details)) || "");
      // column <tbl.col> does not exist  OR  column rr_ratio does not exist
      let m = /column\s+"?([\w.]+)"?\s+does\s+not\s+exist/i.exec(raw) || /column\s+([\w.]+)\s+does\s+not\s+exist/i.exec(raw);
      if (m && m[1]) {
        const path = m[1];
        if (path.includes('.')) {
          const parts = path.replace(/"/g, '').split('.');
          meta.column = parts.pop();
          const rel = parts.pop();
          if (rel) meta.table = rel.replace(/^public\./, '');
        } else {
          meta.column = path.replace(/"/g, '');
        }
      }
      // relation <schema.table> does not exist
      m = /relation\s+"?([\w.]+)"?\s+does\s+not\s+exist/i.exec(raw);
      if (m && m[1]) {
        const rel = m[1].replace(/"/g, '');
        meta.relation = rel;
        const simple = rel.split('.').pop();
        if (simple && !meta.table) meta.table = simple;
      }
    } catch {}
    return meta;
  }

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = (data?.user?.id as string | undefined) || null;
      if (!mounted) return;
      setUserId(uid);
      setNewItem(emptyRow(uid));
      if (!isSupabaseConfigured || !uid) return;
      await Promise.all([fetchRows(uid), fetchAccounts(uid)]);
    })();
    return () => { mounted = false; };
  }, []);

  async function fetchRows(uid: string) {
    try {
      setLoading(true);
      setError(null);
      setOk(null);
      const anyClient: any = supabase;
      const { data, error } = await anyClient
        .from(TABLE)
        .select("account_id,risk_calc_mode,max_open_risk_pct,max_daily_drawdown_pct,max_daily_profit_pct")
        .eq("user_id", uid)
        .order("account_id", { ascending: true });
      if (error) throw error;
      setRows(Array.isArray(data) ? (data as RiskLimitRow[]) : []);
    } catch (e: any) {
      setError(formatError(e));
      setErrorMeta(parseDbError(e));
    } finally {
      setLoading(false);
    }
  }

  async function fetchAccountMeta(uid: string, accId: number) {
    if (!isSupabaseConfigured) { setAccStatus(null); return; }
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("initial_balance,day_start_balance")
        .eq("user_id", uid)
        .eq("account_id", accId)
        .single();
      if (error) throw error;
      const initialRaw: any = data ? (data as any).initial_balance : null;
      const daystartRaw: any = data ? (data as any).day_start_balance : null;
      const initial = (initialRaw !== null && initialRaw !== undefined && initialRaw !== "") ? Number(initialRaw) : null;
      const daystart = (daystartRaw !== null && daystartRaw !== undefined && daystartRaw !== "") ? Number(daystartRaw) : null;
      const base = (typeof daystart === 'number' && typeof initial === 'number') ? Math.max(daystart - initial, 0) : null;
      setAccStatus({ initial, daystart, base });
      if (initial != null) setEditInitial(String(initial));
    } catch (e) {
      setAccStatus(null);
      setError(formatError(e));
      setErrorMeta(parseDbError(e));
    }
  }

  async function saveInitialBalance(val: number | null) {
    if (!isSupabaseConfigured || !userId || !selectedAccount) return;
    try {
      setSaving(true);
      setError(null);
      const account_id = Number(selectedAccount);
      const payload: any = { user_id: userId, account_id, initial_balance: val };
      const anyClient: any = supabase;
      // Prefer upsert so row is created if missing
      if (typeof anyClient.from("accounts").upsert === "function") {
        const { error } = await anyClient
          .from("accounts")
          .upsert(payload, { onConflict: "user_id,account_id" });
        if (error) throw error;
      } else {
        // Fallback: update, then insert if update affected 0 rows
        const { error: upErr, count } = await anyClient
          .from("accounts")
          .update({ initial_balance: val })
          .eq("user_id", userId)
          .eq("account_id", account_id)
          .select("user_id", { count: "exact", head: true });
        if (upErr) throw upErr;
        if (!count || count === 0) {
          const { error: insErr } = await anyClient.from("accounts").insert(payload);
          if (insErr) throw insErr;
        }
      }
      setOk("بالانس اولیه ثبت شد");
      await fetchAccountMeta(userId, account_id);
    } catch (e: any) {
      setError(formatError(e));
      setErrorMeta(parseDbError(e));
    } finally {
      setSaving(false);
    }
  }

  async function fetchAccounts(uid: string) {
    try {
      const anyClient: any = supabase;
      const { data, error } = await anyClient
        .from("accounts")
        .select("account_id")
        .eq("user_id", uid)
        .order("account_id", { ascending: true });
      if (error) throw error;
      const ids = Array.isArray(data) ? (data as any[]).map((r) => Number(r.account_id)).filter((n) => Number.isFinite(n)) : [];
      setAccounts(ids);
    } catch (e) {
      // silent; accounts table may not exist yet
    }
  }

  function onSelectAccount(accRaw: string) {
    const acc = accRaw ? Number(accRaw) : NaN;
    if (!Number.isFinite(acc)) {
      setSelectedAccount("");
      setNewItem(emptyRow(userId));
      setAccStatus(null);
      return;
    }
    setSelectedAccount(acc);
    const exist = rows.find((r) => r.account_id === acc);
    const base = exist ? { ...exist } : { ...emptyRow(userId), account_id: acc };
    setNewItem(base);
    // fetch account meta for status
    if (userId) void fetchAccountMeta(userId, acc);
  }

  async function upsertRow(r: RiskLimitRow) {
    if (!isSupabaseConfigured || !userId) return;
    try {
      setSaving(true);
      setError(null);
      setOk(null);
      const payload = { ...r, user_id: userId, account_id: Number(r.account_id || 0) } as any;
      // Coerce empties to nulls for optional fields
      for (const k of [
        "max_risk_per_trade_amount",
        "virtual_sl_pips",
        "tp_fixed_pips",
        "max_daily_drawdown_pct",
        "max_weekly_drawdown_pct",
        "max_daily_profit_pct",
        "max_weekly_profit_pct",
      ]) {
        if (payload[k] === "" || payload[k] === undefined) payload[k] = null;
      }
      const anyClient: any = supabase;
      if (typeof anyClient.from(TABLE).upsert === "function") {
        const { error } = await anyClient.from(TABLE).upsert(payload, { onConflict: "user_id,account_id" });
        if (error) throw error;
      } else {
        const { error: upErr } = await supabase.from(TABLE).update(payload).eq("user_id", userId).eq("account_id", payload.account_id);
        if (upErr) {
          const { error: insErr } = await supabase.from(TABLE).insert(payload);
          if (insErr) throw insErr;
        }
      }
      setOk("ذخیره شد");
      // refresh
      await fetchRows(userId);
      if (selectedAccount) await fetchAccountMeta(userId, Number(selectedAccount));
    } catch (e: any) {
      setError(formatError(e));
      setErrorMeta(parseDbError(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(accId: number) {
    if (!isSupabaseConfigured || !userId) return;
    try {
      setSaving(true);
      setError(null);
      setOk(null);
      const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).eq("account_id", accId);
      if (error) throw error;
      setOk("حذف شد");
      await fetchRows(userId);
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setSaving(false);
    }
  }

  const L = (props: { label: string; children: React.ReactNode }) => (
    <label className="block text-xs text-zinc-600 dark:text-zinc-300 text-right">
      <span className="block mb-1">{props.label}</span>
      <span className="block">{props.children}</span>
    </label>
  );

  return (
    <div dir="rtl" className="space-y-4 p-4 text-right border border-gray-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 card-surface">
      {(error || !isSupabaseConfigured) && (
        <div className={
          "sticky top-0 z-50 -mt-4 -mx-4 px-4 py-2 text-sm border-b " +
          (error
            ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800")
        }>
          <div className="font-medium">
            {error || "Supabase پیکربندی نشده است؛ مقادیر NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY را در .env تنظیم کنید."}
          </div>
          {error && (
            <div className="mt-1 text-xs grid sm:grid-cols-4 gap-2">
              <div><span className="text-zinc-500">ستون:</span> <span className="font-medium">{errorMeta?.column ?? '—'}</span></div>
              <div><span className="text-zinc-500">جدول:</span> <span className="font-medium">{errorMeta?.table ?? (errorMeta?.relation ?? '—')}</span></div>
              <div><span className="text-zinc-500">رابطه:</span> <span className="font-medium">{errorMeta?.relation ?? '—'}</span></div>
              <div><span className="text-zinc-500">کد:</span> <span className="font-medium">{errorMeta?.code ?? '—'}</span></div>
            </div>
          )}
        </div>
      )}
      <div>
        <h3 className="text-lg font-semibold">تنظیمات ریسک حساب‌ها</h3>
        <p className="text-sm text-gray-600 dark:text-zinc-300">تعریف سقف ریسک و سیاست‌های TP/SL برای هر حساب (per-account)</p>
      </div>
      {ok && (
        <div className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300 p-2 rounded" dir="auto">{ok}</div>
      )}

      {/* Account picker */}
      {isSupabaseConfigured && userId && (
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <L label="انتخاب اکانت">
            <select
              className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right"
              value={selectedAccount as any}
              onChange={(e) => onSelectAccount(e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
              {accounts.map((acc) => (
                <option key={acc} value={acc}>#{acc}</option>
              ))}
            </select>
          </L>
          <div className="md:col-span-2 text-xs text-zinc-600 dark:text-zinc-300">
            پس از انتخاب اکانت، فرم تنظیمات برای همان اکانت نمایش داده می‌شود.
          </div>
        </div>
      )}

      {/* Single-account form (simplified) */}
      {selectedAccount && (
        <div className="grid md:grid-cols-4 gap-3 p-3 rounded border border-gray-200 dark:border-zinc-700">
          <div className="md:col-span-4 text-sm text-zinc-600 dark:text-zinc-300 flex items-center justify-between">
            <div>اکانت انتخابی: <b>#{selectedAccount}</b></div>
          </div>

          {/* Status panel */}
          <div className="md:col-span-4 grid sm:grid-cols-3 gap-2 p-2 rounded bg-zinc-50 dark:bg-zinc-900/40 border border-dashed border-gray-300 dark:border-zinc-700 text-sm">
            <div>
              <div className="text-xs text-zinc-500">بالانس اولیه</div>
              <div className="font-medium">{accStatus?.initial != null ? accStatus.initial.toLocaleString() : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">بالانس اول روز</div>
              <div className="font-medium">{accStatus?.daystart != null ? accStatus.daystart.toLocaleString() : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">پایه ریسک (DayStart - Initial)</div>
              <div className="font-medium">{accStatus?.base != null ? accStatus.base.toLocaleString() : '—'}</div>
            </div>
          </div>

          {/* Initial balance fix */}
          <div className="md:col-span-4 grid sm:grid-cols-3 gap-2 items-end">
            <div className="text-xs text-zinc-600 dark:text-zinc-300">
              اگر «بالانس اولیه» ثبت نشده، مقدار زیر را وارد و ذخیره کنید.
            </div>
            <input
              type="number"
              inputMode="decimal"
              placeholder="مثلاً 1000"
              className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right"
              value={editInitial}
              onChange={(e) => setEditInitial(e.target.value)}
              dir="ltr"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveInitialBalance(editInitial === "" ? null : Number(editInitial))}
                disabled={saving || !selectedAccount}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                ثبت بالانس اولیه
              </button>
              {accStatus?.daystart != null && (
                <button
                  type="button"
                  onClick={() => { setEditInitial(String(accStatus.daystart)); saveInitialBalance(accStatus.daystart!); }}
                  disabled={saving || !selectedAccount}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  برابر با بالانس روز
                </button>
              )}
            </div>
          </div>
          <L label="نوع محاسبه ریسک">
            <select
              className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right"
              value={newItem.risk_calc_mode ?? "day_start_balance"}
              onChange={(e) => setNewItem({ ...newItem, risk_calc_mode: e.target.value as any })}
            >
              <option value="day_start_balance">بالانس اول روز</option>
              <option value="initial_balance">بالانس اولیه</option>
            </select>
          </L>
          <L label="حداکثر ریسک باز (%)">
            <input
              type="number" step="0.1" min="0"
              className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right"
              value={newItem.max_open_risk_pct ?? ""}
              onChange={(e) => setNewItem({ ...newItem, max_open_risk_pct: e.target.value === "" ? null : parseFloat(e.target.value) })}
            />
          </L>
          <L label="Max Daily DD %">
            <input
              type="number" step="0.1" min="0"
              className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right"
              value={newItem.max_daily_drawdown_pct ?? ""}
              onChange={(e) => setNewItem({ ...newItem, max_daily_drawdown_pct: e.target.value === "" ? null : parseFloat(e.target.value) })}
            />
          </L>
          <L label="Max Daily Profit %">
            <input
              type="number" step="0.1" min="0"
              className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right"
              value={newItem.max_daily_profit_pct ?? ""}
              onChange={(e) => setNewItem({ ...newItem, max_daily_profit_pct: e.target.value === "" ? null : parseFloat(e.target.value) })}
            />
          </L>

          <div className="md:col-span-4 flex gap-2">
            <button
              onClick={async () => { await upsertRow({ ...newItem, account_id: Number(selectedAccount) }); setOk("ذخیره شد"); }}
              disabled={saving || !userId || !selectedAccount}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >ذخیره</button>
            <button
              onClick={() => deleteRow(Number(selectedAccount))}
              disabled={saving || !userId || !selectedAccount}
              className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
            >حذف</button>
          </div>
        </div>
      )}

      {/* سایر تنظیمات قدیمی حذف شده‌اند تا تمرکز روی سه فیلد کلیدی باشد */}
    </div>
  );
};
