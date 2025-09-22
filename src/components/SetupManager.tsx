"use client";

import React from "react";
import { PencilSquareIcon, TrashIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export type SetupRow = {
  id: string;
  user_id: string;
  name: string;
  rr_ratio: number;
  risk_per_trade_pct?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export default function SetupManager() {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<SetupRow[]>([]);
  // no account binding for setups anymore

  // form
  const [name, setName] = React.useState<string>("");
  const [rr, setRr] = React.useState<string>("2.0");
  const [risk, setRisk] = React.useState<string>("1.0");
  // removed account field
  const [notes, setNotes] = React.useState<string>("");
  const [editId, setEditId] = React.useState<string | null>(null);
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [modalTitle, setModalTitle] = React.useState<string>("ایجاد ستاپ");
  const [showDelete, setShowDelete] = React.useState<boolean>(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleteName, setDeleteName] = React.useState<string>("");
  const [search, setSearch] = React.useState<string>("");
  const [sortKey, setSortKey] = React.useState<"created_at" | "name" | "rr_ratio" | "risk_per_trade_pct">("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = (data?.user?.id as string | undefined) || null;
      if (!mounted) return;
      setUserId(uid);
      if (!uid || !isSupabaseConfigured) { setLoading(false); return; }
      await fetchRows(uid);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // refetch on search/sort changes
  React.useEffect(() => {
    if (userId) fetchRows(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, search, sortKey, sortDir]);

  function fmtErr(err: any): string {
    const raw = String((err && (err.message || err.error || err.msg)) || err || "خطای ناشناخته");
    const s = raw.toLowerCase();
    if (/column\s+.+\s+does\s+not\s+exist/.test(s)) return "ستونی که به آن اشاره شده وجود ندارد (column not found).";
    if (/relation\s+.+\s+does\s+not\s+exist/.test(s)) return "جدول/نما پیدا نشد (relation not found).";
    if (/permission\s+denied/.test(s)) return "مجوز دسترسی کافی نیست (احتمالاً RLS یا سطح دسترسی).";
    if (/row\s+level\s+security|rls/.test(s)) return "سیاست‌های RLS مانع دسترسی شده‌اند.";
    if (/failed\s+to\s+fetch|networkerror|network\s+error/.test(s)) return "عدم ارتباط با سرور Supabase (مشکل شبکه).";
    if (/invalid\s+authentication|jwt|auth/.test(s)) return "مشکل احراز هویت با Supabase؛ لطفاً دوباره وارد شوید.";
    return raw;
  }

  // Pretty number formatting (trim trailing zeros)
  function fmtNum(value: any, decimals = 2): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    const s = n.toFixed(decimals);
    return s.replace(/\.0+$/, "").replace(/(\.\d*?[1-9])0+$/, "$1");
  }

  async function fetchRows(uid: string) {
    try {
      setError(null);
      const anyClient: any = supabase;
      let q = anyClient
        .from("setup_templates")
        .select("id,user_id,name,rr_ratio,risk_per_trade_pct,notes,created_at,updated_at")
        .eq("user_id", uid);
      const s = (search || "").trim();
      if (s) {
        q = q.or(`name.ilike.%${s}%,notes.ilike.%${s}%`);
      }
      q = q.order(sortKey, { ascending: sortDir === "asc" });
      const { data, error } = await q;
      if (error) throw error;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(fmtErr(e));
    }
  }

  function resetForm() {
    setEditId(null);
    setName("");
    setRr("2.0");
    setRisk("1.0");
    setNotes("");
  }

  function openCreate() {
    resetForm();
    setModalTitle("ایجاد ستاپ");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  // ESC to close modal
  React.useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  // ESC to close delete confirm
  React.useEffect(() => {
    if (!showDelete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowDelete(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDelete]);

  async function saveRow() {
    if (!userId || !isSupabaseConfigured) return;
    try {
      setSaving(true);
      setError(null);
      const payload: any = {
        user_id: userId,
        name: (name || "").trim(),
        rr_ratio: rr === "" ? null : Number(rr),
        risk_per_trade_pct: risk === "" ? null : Number(risk),
        notes: (notes || null),
      };
      if (!payload.name || !payload.rr_ratio) {
        setError("نام و ریوارد ستاپ الزامی است.");
        return;
      }
      const anyClient: any = supabase;
      if (editId) {
        const { error } = await anyClient.from("setup_templates").update(payload).eq("id", editId).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await anyClient.from("setup_templates").insert(payload);
        if (error) throw error;
      }
      resetForm();
      await fetchRows(userId);
      setShowModal(false);
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setSaving(false);
    }
  }

  async function onEdit(r: SetupRow) {
    setEditId(r.id);
    setName(r.name || "");
    setRr(String(r.rr_ratio ?? ""));
    setRisk(String(r.risk_per_trade_pct ?? ""));
    setNotes(r.notes || "");
    setModalTitle("ویرایش ستاپ");
    setShowModal(true);
  }

  function requestDelete(row: SetupRow) {
    setDeleteId(row.id);
    setDeleteName(row.name);
    setShowDelete(true);
  }

  async function confirmDelete() {
    if (!userId || !isSupabaseConfigured || !deleteId) return;
    try {
      setSaving(true);
      setError(null);
      const { error } = await supabase.from("setup_templates").delete().eq("id", deleteId).eq("user_id", userId);
      if (error) throw error;
      await fetchRows(userId);
      setShowDelete(false);
      setDeleteId(null);
      setDeleteName("");
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>در حال بارگذاری…</div>;
  if (!userId) return <div>برای مدیریت ستاپ‌ها ابتدا وارد حساب شوید.</div>;

  return (
    <div dir="rtl" className="space-y-4 p-4 text-right">
      {(!isSupabaseConfigured || error) && (
        <div className={
          "sticky top-0 z-50 -mt-4 -mx-4 px-4 py-2 text-sm border-b " +
          (error ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800")
        }>
          {error || "Supabase پیکربندی نشده است؛ مقادیر NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY را در .env تنظیم کنید."}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">مدیریت ستاپ‌ها</h3>
          <button
            onClick={openCreate}
            title="ایجاد"
            aria-label="ایجاد"
            className="p-2 rounded-full border border-blue-500/30 bg-blue-500/15 text-blue-500 hover:bg-blue-500/25"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در نام/یادداشت"
            className="w-56 border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right"
          />
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} className="border rounded px-2 py-1 bg-white dark:bg-zinc-800">
            <option value="created_at">مرتب‌سازی: تاریخ</option>
            <option value="name">مرتب‌سازی: نام</option>
            <option value="rr_ratio">مرتب‌سازی: RR</option>
            <option value="risk_per_trade_pct">مرتب‌سازی: ریسک (%)</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700"
            title={sortDir === "asc" ? "مرتب‌سازی صعودی" : "مرتب‌سازی نزولی"}
            aria-label="toggle sort direction"
          >
            {sortDir === "asc" ? (
              <ArrowUpIcon className="h-5 w-5" />
            ) : (
              <ArrowDownIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* modal: create/edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative w-full max-w-xl mx-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 card-surface" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">{modalTitle}</div>
              <button onClick={closeModal} className="px-2 py-1 rounded bg-zinc-600 hover:bg-zinc-700 text-white">×</button>
            </div>
            <form className="grid md:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); saveRow(); }}>
              <label className="block text-sm">
                <span className="block mb-1">نام ستاپ</span>
                <input autoFocus required className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="block mb-1">ریوارد (RR)</span>
                <input required min="0" step="0.1" type="number" className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right" value={rr} onChange={(e) => setRr(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="block mb-1">ریسک هر معامله (%)</span>
                <input required min="0" step="0.1" type="number" className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right" value={risk} onChange={(e) => setRisk(e.target.value)} />
              </label>
              
              <label className="block text-sm">
                <span className="block mb-1">یادداشت</span>
                <input className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving || !name || !rr} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">{editId ? "به‌روزرسانی" : "ثبت"}</button>
              <button onClick={closeModal} disabled={saving} className="px-3 py-1 rounded bg-zinc-500 hover:bg-zinc-600 text-white disabled:opacity-50">انصراف</button>
            </div>
            </form>
          </div>
        </div>
      )}

      {/* delete confirm modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDelete(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 card-surface" role="dialog" aria-modal="true">
            <div className="text-lg font-semibold mb-2">تأیید حذف</div>
            <div className="text-sm mb-4">آیا از حذف ستاپ «{deleteName}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.</div>
            <div className="flex gap-2">
              <button onClick={confirmDelete} disabled={saving} className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50">حذف</button>
              <button onClick={() => setShowDelete(false)} disabled={saving} className="px-3 py-1 rounded bg-zinc-500 hover:bg-zinc-600 text-white disabled:opacity-50">انصراف</button>
            </div>
          </div>
        </div>
      )}

      {/* list */}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-600">هیچ ستاپی ثبت نشده است.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="p-3 rounded border border-gray-200 dark:border-zinc-700 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-col gap-1">
                <div className="font-medium">{r.name}</div>
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-600/15 text-indigo-400">
                    <span>RR</span>
                    <b dir="ltr">{fmtNum(r.rr_ratio, 2)}</b>
                    <span>×</span>
                  </span>
                  {typeof r.risk_per_trade_pct === 'number' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600/15 text-rose-400">
                      <span>Risk</span>
                      <b dir="ltr">{fmtNum(r.risk_per_trade_pct, 2)}</b>
                      <span>%</span>
                    </span>
                  )}
                </div>
                {r.notes && <div className="text-xs text-zinc-400">{r.notes}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEdit(r)}
                  title="ویرایش"
                  aria-label="ویرایش"
                  className="p-2 rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => requestDelete(r)}
                  title="حذف"
                  aria-label="حذف"
                  className="p-2 rounded-full border border-rose-500/30 bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 disabled:opacity-50"
                  disabled={saving}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
