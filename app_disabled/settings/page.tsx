"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { SignedIn, useAuth } from "@clerk/nextjs";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const Settings = dynamic(() => import("@/components/Settings").then(m => m.Settings), { ssr: false });

export default function SettingsPage() {
  const desktopMode = (() => {
    const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();
  const { isLoaded, isSignedIn } = useAuth();
  const sessionEnabled = (() => {
    const v = String(process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();
  const [sbStatus, setSbStatus] = React.useState<"na"|"ok"|"fail"|"disabled">("na");
  const [sbMsg, setSbMsg] = React.useState<string>("");

  const refresh = React.useCallback(async () => {
    try {
      if (!isSupabaseConfigured) {
        setSbStatus("fail");
        setSbMsg("Supabase از runtime config پیکربندی نشده است");
        return;
      }
      if (!sessionEnabled) {
        setSbStatus("disabled");
        setSbMsg("سشن کلاینت Supabase طبق تنظیمات غیرفعال است");
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setSbStatus("fail");
        setSbMsg(error?.message || "No Supabase session");
      } else {
        setSbStatus("ok");
        const exp = data.session.expires_at ? new Date(data.session.expires_at * 1000) : null;
        setSbMsg(exp ? `انقضاء: ${exp.toLocaleString()}` : "سشن فعال");
      }
    } catch (e: any) {
      setSbStatus("fail");
      setSbMsg(e?.message || String(e));
    }
  }, [sessionEnabled]);

  if (desktopMode) {
    React.useEffect(() => { void refresh(); }, [refresh]);
    return (
      <>
        <div className="mb-6 p-4 rounded-lg border bg-white dark:bg-zinc-900" dir="rtl">
          <div className="font-semibold mb-2">وضعیت سشن</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>Clerk: N/A (desktop mode)</div>
            <div>
              Supabase: {sbStatus === "ok" ? "✅" : sbStatus === "fail" ? "❌" : sbStatus === "disabled" ? "غیرفعال" : "…"}
            </div>
            <div className="sm:col-span-2 opacity-80">{sbMsg || ""}</div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={refresh} className="px-3 py-2 rounded bg-indigo-600 text-white">بازخوانی وضعیت</button>
          </div>
        </div>
        <Settings />
      </>
    );
  }

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  return (
    <>
      <SignedIn>
        <div className="mb-6 p-4 rounded-lg border bg-white dark:bg-zinc-900" dir="rtl">
          <div className="font-semibold mb-2">وضعیت سشن</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>Clerk: {isLoaded && isSignedIn ? "✅" : "❌"}</div>
            <div>
              Supabase: {sbStatus === "ok" ? "✅" : sbStatus === "fail" ? "❌" : sbStatus === "disabled" ? "غیرفعال" : "…"}
            </div>
            <div className="sm:col-span-2 opacity-80">{sbMsg || ""}</div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={refresh} className="px-3 py-2 rounded bg-indigo-600 text-white">بازخوانی وضعیت</button>
          </div>
        </div>
        <Settings />
      </SignedIn>
      
    </>
  );
}
