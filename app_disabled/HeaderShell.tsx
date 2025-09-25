"use client";

import * as React from "react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { BoltIcon } from "@heroicons/react/24/solid";
import { UserButton, SignedIn } from "@clerk/nextjs";
import { openHostedSignIn } from "@/lib/auth/deepLink";
// Read desktop mode flag directly from env (no runtime config)

export default function HeaderShell() {
  const desktopMode = (() => {
    const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();

  if (desktopMode) {
    const onLogin = async () => {
      try { await openHostedSignIn("metapip://auth/callback"); } catch {}
    };
    return (
      <>
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/events"
              aria-label="رویدادها"
              title="رویدادها"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700"
            >
              <BoltIcon className="h-5 w-5" />
            </Link>
            <button onClick={onLogin} className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm">ورود</button>
          </div>
          <h1 className="text-2xl font-semibold">MetaPip</h1>
        </header>

        <nav className="flex gap-2 mt-2">
          <Link href="/dashboard" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">داشبورد</Link>
          <Link href="/settings" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">تنظیمات</Link>
          <Link href="/diagnostics" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">عیب‌یابی</Link>
          <Link href="/chart-templates" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">قالب نمودار</Link>
          <Link href="/positions" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">پوزیشن‌ها</Link>
          <Link href="/risk" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">کنترل ریسک</Link>
          <Link href="/setups" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">ستاپ‌ها</Link>
          <Link href="/devices" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">دستگاه‌ها</Link>
        </nav>
      </>
    );
  }

  return (
    <SignedIn>
      <header className="flex items-center justify-between">
        {/* In RTL, first child appears on the right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/events"
            aria-label="رویدادها"
            title="رویدادها"
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700"
          >
            <BoltIcon className="h-5 w-5" />
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
        <h1 className="text-2xl font-semibold">MetaPip</h1>
      </header>

      <nav className="flex gap-2">
        <Link href="/dashboard" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">داشبورد</Link>
        <Link href="/settings" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">تنظیمات</Link>
        <Link href="/diagnostics" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">عیب‌یابی</Link>
        <Link href="/chart-templates" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">قالب نمودار</Link>
        <Link href="/positions" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">پوزیشن‌ها</Link>
        <Link href="/risk" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">کنترل ریسک</Link>
        <Link href="/setups" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">ستاپ‌ها</Link>
        <Link href="/devices" className="px-3 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100">دستگاه‌ها</Link>
      </nav>
    </SignedIn>
  );
}

