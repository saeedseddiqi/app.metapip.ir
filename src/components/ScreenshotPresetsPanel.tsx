"use client";

import React from "react";
import { PencilSquareIcon, TrashIcon, PlusIcon, EyeIcon, CheckIcon } from "@heroicons/react/24/outline";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { TVPreset } from "../lib/preset64";
import PresetBuilder from "./PresetBuilder";
import ChartPreview from "./ChartPreview";

export type ScreenshotPresetRow = {
  id: number;
  user_id: string;
  name: string;
  preset64: string;
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

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

export default function ScreenshotPresetsPanel() {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<ScreenshotPresetRow[]>([]);
  const [globalDefault, setGlobalDefault] = React.useState<ScreenshotPresetRow | null>(null);

  // form
  const [name, setName] = React.useState<string>("");
  const [jsonText, setJsonText] = React.useState<string>("{}");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState<boolean>(false);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [modalTitle, setModalTitle] = React.useState<string>("ایجاد قالب نمودار");
  const [showDelete, setShowDelete] = React.useState<boolean>(false);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [deleteName, setDeleteName] = React.useState<string>("");
  const [initialPreset, setInitialPreset] = React.useState<TVPreset | undefined>(undefined);

  // preview
  const [showPreview, setShowPreview] = React.useState<boolean>(false);
  const [previewName, setPreviewName] = React.useState<string>("");
  const [previewPreset, setPreviewPreset] = React.useState<TVPreset | null>(null);
  const [previewSymbol] = React.useState<string>("EURUSD");

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = (data?.user?.id as string | undefined) || null;
        if (!mounted) return;
        setUserId(uid);
        if (!uid || !isSupabaseConfigured) { setLoading(false); return; }
        await fetchRows(uid);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function openPreviewFromRow(row: ScreenshotPresetRow) {
    try {
      const obj = JSON.parse(atob(row.preset64)) as TVPreset;
      setPreviewName(row.name || "پیش‌نمایش");
      setPreviewPreset(obj);
      setShowPreview(true);
    } catch {
      setError("قالب انتخاب‌شده قابل پیش‌نمایش نیست.");
    }
  }

  function openPreviewFromGlobal() {
    if (!globalDefault) return;
    try {
      const obj = JSON.parse(atob(globalDefault.preset64)) as TVPreset;
      setPreviewName(globalDefault.name || "Default");
      setPreviewPreset(obj);
      setShowPreview(true);
    } catch {
      setError("قالب عمومی قابل پیش‌نمایش نیست.");
    }
  }

  async function fetchRows(uid: string) {
    try {
      setError(null);
      const { data, error } = await supabase
        .from("presets")
        .select("id,user_id,name,preset64,is_active,created_at,updated_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows(Array.isArray(data) ? (data as ScreenshotPresetRow[]) : []);
      // Fetch global default (public) preset by name
      try {
        const { data: gdef } = await supabase
          .from("presets")
          .select("id,user_id,name,preset64,is_active,created_at,updated_at")
          .eq("name", "Default")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        setGlobalDefault((gdef as any) || null);
      } catch {
        setGlobalDefault(null);
      }
    } catch (e) {
      setError(fmtErr(e));
    }
  }

  function resetForm() {
    setEditId(null);
    setName("");
    setJsonText("{}");
    setFormError(null);
    setIsActive(false);
    setInitialPreset({} as TVPreset);
  }

  function openCreate() {
    resetForm();
    setModalTitle("ایجاد قالب نمودار");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  // ESC close
  React.useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  // ESC close delete confirm
  React.useEffect(() => {
    if (!showDelete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowDelete(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDelete]);

  async function saveRow() {
    if (!userId || !isSupabaseConfigured) return;
    // Validate name
    const nm = (name || "").trim();
    if (!nm) { setFormError("نام پریست الزامی است."); return; }
    // Validate JSON
    let obj: TVPreset;
    try {
      obj = JSON.parse(jsonText || "{}") as TVPreset;
      setFormError(null);
    } catch {
      setFormError("JSON نامعتبر است");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // If set active, unset others first (only one active per user)
      if (isActive) {
        const { error: unsetError } = await supabase
          .from("presets")
          .update({ is_active: false })
          .eq("user_id", userId)
          .eq("is_active", true);
        if (unsetError) throw unsetError;
      }

      const preset64 = (() => {
        try { return btoa(JSON.stringify(obj)); } catch { return ""; }
      })();
      const payload: any = {
        user_id: userId,
        name: nm,
        preset64,
        is_active: isActive,
      };

      if (editId) {
        const { error } = await supabase
          .from("presets")
          .update(payload)
          .eq("id", editId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("presets")
          .insert(payload);
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

  async function onEdit(r: ScreenshotPresetRow) {
    try {
      const obj = JSON.parse(atob(r.preset64)) as TVPreset;
      setEditId(r.id);
      setName(r.name || "");
      setJsonText(JSON.stringify(obj ?? {}, null, 2));
      setFormError(null);
      setIsActive(Boolean(r.is_active));
      setModalTitle("ویرایش قالب نمودار");
      setInitialPreset(obj);
      setShowModal(true);
    } catch (e) {
      setError("خطا در بارگذاری تنظیمات پریست");
    }
  }

  function requestDelete(row: ScreenshotPresetRow) {
    setDeleteId(row.id);
    setDeleteName(row.name);
    setShowDelete(true);
  }

  async function confirmDelete() {
    if (!userId || !isSupabaseConfigured || !deleteId) return;
    try {
      setSaving(true);
      setError(null);
      const { error } = await supabase
        .from("presets")
        .delete()
        .eq("id", deleteId)
        .eq("user_id", userId);
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
  if (!userId) return <div>برای مدیریت قالب‌های نمودار ابتدا وارد حساب شوید.</div>;

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

      {/* preview modal */}
      {showPreview && previewPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
          <div className="relative w-full max-w-5xl h-[70vh] mx-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 card-surface" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">پیش‌نمایش: {previewName}</div>
              <button onClick={() => setShowPreview(false)} className="px-2 py-1 rounded bg-zinc-600 hover:bg-zinc-700 text-white">×</button>
            </div>
            <ChartPreview preset={previewPreset} symbol={previewSymbol} height={520} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">مدیریت قالب‌های نمودار</h3>
          <button
            onClick={openCreate}
            title="ایجاد"
            aria-label="ایجاد"
            className="p-2 rounded-full border border-blue-500/30 bg-blue-500/15 text-blue-500 hover:bg-blue-500/25"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* modal: create/edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative w-full max-w-3xl mx-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 card-surface" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">{modalTitle}</div>
              <button onClick={closeModal} className="px-2 py-1 rounded bg-zinc-600 hover:bg-zinc-700 text-white">×</button>
            </div>
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); saveRow(); }}>
              <label className="block text-sm">
                <span className="block mb-1">نام قالب نمودار</span>
                <input autoFocus required className="w-full border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-right" value={name} onChange={(e) => setName(e.target.value)} />
              </label>

              <div className="block text-sm">
                <div className="block mb-1">سازنده قالب نمودار</div>
                <div className="rounded border border-gray-200 dark:border-zinc-700 card-surface">
                  <PresetBuilder
                    initial={initialPreset}
                    onChange={(p) => { try { setJsonText(JSON.stringify(p)); setFormError(null); } catch { /* noop */ } }}
                  />
                </div>
                {formError && <div className="text-xs text-rose-600 mt-1" dir="auto">{formError}</div>}
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span>فعال باشد؟</span>
              </label>

              <div className="mt-2 flex gap-2">
                <button type="submit" disabled={saving || !name || !!formError} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">{editId ? "به‌روزرسانی" : "ثبت"}</button>
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
            <div className="text-sm mb-4">آیا از حذف قالب «{deleteName}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.</div>
            <div className="flex gap-2">
              <button onClick={confirmDelete} disabled={saving} className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50">حذف</button>
              <button onClick={() => setShowDelete(false)} disabled={saving} className="px-3 py-1 rounded bg-zinc-500 hover:bg-zinc-600 text-white disabled:opacity-50">انصراف</button>
            </div>
          </div>
        </div>
      )}

      {/* list */}
      <div className="space-y-2">
        {/* Global Default pseudo-row (read-only) */}
        {globalDefault && (
          <div className="p-3 rounded border border-dashed border-gray-300 dark:border-zinc-700 flex flex-wrap items-center gap-3 justify-between bg-gray-50 dark:bg-zinc-900/40 card-surface">
            <div className="flex items-center gap-3">
              <div className="font-medium">{globalDefault.name}</div>
              <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-sky-600/15 text-sky-600">عمومی</span>
              {!rows.some(r => r.is_active) && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-green-600/15 text-green-500">فعال</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openPreviewFromGlobal}
                title="پیش‌نمایش"
                aria-label="پیش‌نمایش"
                className="p-2 rounded-full border border-blue-500/30 bg-blue-500/15 text-blue-500 hover:bg-blue-500/25"
              >
                <EyeIcon className="w-4 h-4" />
              </button>
              {rows.some(r => r.is_active) ? (
                <button
                  onClick={async () => {
                    if (!userId) return;
                    try {
                      setSaving(true); setError(null);
                      await supabase.from("presets").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
                      await fetchRows(userId);
                    } catch (e) {
                      setError(fmtErr(e));
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="p-2 rounded-full border border-sky-500/30 bg-sky-500/15 text-sky-600 hover:bg-sky-500/25"
                  title="فعال‌سازی پیش‌فرض عمومی"
                  aria-label="فعال‌سازی پیش‌فرض عمومی"
                >
                  <CheckIcon className="w-4 h-4" />
                </button>
              ) : (
                <button disabled className="p-2 rounded-full border border-gray-300 text-gray-400 cursor-default" title="درحال استفاده">
                  درحال استفاده
                </button>
              )}
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="text-sm text-zinc-600">هیچ قالبی ثبت نشده است.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="p-3 rounded border border-gray-200 dark:border-zinc-700 flex flex-wrap items-center gap-3 justify-between card-surface">
              <div className="flex items-center gap-3">
                <div className="font-medium">{r.name}</div>
                {r.is_active && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-green-600/15 text-green-500">فعال</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openPreviewFromRow(r)}
                  title="پیش‌نمایش"
                  aria-label="پیش‌نمایش"
                  className="p-2 rounded-full border border-blue-500/30 bg-blue-500/15 text-blue-500 hover:bg-blue-500/25"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                {!r.is_active && (
                  <button
                    onClick={async () => {
                      if (!userId) return;
                      try {
                        setSaving(true); setError(null);
                        await supabase.from("presets").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
                        await supabase.from("presets").update({ is_active: true }).eq("id", r.id).eq("user_id", userId);
                        await fetchRows(userId);
                      } catch (e) {
                        setError(fmtErr(e));
                      } finally {
                        setSaving(false);
                      }
                    }}
                    title="فعال‌سازی"
                    aria-label="فعال‌سازی"
                    className="p-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
                  >
                    <CheckIcon className="w-4 h-4" />
                  </button>
                )}
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
