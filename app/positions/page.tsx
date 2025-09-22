"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SignedIn, SignedOut } from "@clerk/nextjs";

const OpenPositionsTable = dynamic(() => import("@/components/OpenPositionsTable"), { ssr: false });
const TradesJournalTable = dynamic(() => import("@/components/TradesJournalTable"), { ssr: false });

export default function PositionsPage() {
  const [tab, setTab] = useState<"open" | "journal">("open");
  const desktopMode = (() => {
    const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();

  // In desktop mode, ClerkProvider is disabled; render content directly without SignedIn/SignedOut
  if (desktopMode) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">پوزیشن‌ها و ژورنال تریدها</h1>
          <p className="text-sm text-gray-600 dark:text-zinc-300">اطلاعات از Supabase: جدول‌های public.positions و public.trades (نمای journal_trades_v)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("open")}
            className={`px-3 py-1.5 rounded-md text-sm ${tab === "open" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100"}`}
          >
            پوزیشن‌های باز
          </button>
          <button
            onClick={() => setTab("journal")}
            className={`px-3 py-1.5 rounded-md text-sm ${tab === "journal" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100"}`}
          >
            ژورنال تریدها
          </button>
        </div>

        {tab === "open" ? <OpenPositionsTable /> : <TradesJournalTable />}
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold mb-2">پوزیشن‌ها و ژورنال تریدها</h1>
            <p className="text-sm text-gray-600 dark:text-zinc-300">اطلاعات از Supabase: جدول‌های public.positions و public.trades (نمای journal_trades_v)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("open")}
              className={`px-3 py-1.5 rounded-md text-sm ${tab === "open" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100"}`}
            >
              پوزیشن‌های باز
            </button>
            <button
              onClick={() => setTab("journal")}
              className={`px-3 py-1.5 rounded-md text-sm ${tab === "journal" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100"}`}
            >
              ژورنال تریدها
            </button>
          </div>

          {tab === "open" ? <OpenPositionsTable /> : <TradesJournalTable />}
        </div>
      </SignedIn>
      <SignedOut>{/* Redirected by middleware */}</SignedOut>
    </>
  );
}
