"use client";

import * as React from "react";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { BoltIcon } from "@heroicons/react/24/solid";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full">
        {/* Brand / Intro (left) */}
        <div className="hidden md:flex flex-col items-center justify-center h-full px-12 bg-emerald-600/90 text-white">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white shadow">
              <BoltIcon className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">MetaPip</h2>
              <p className="text-sm text-white/80">مدیریت هوشمند ترمینال و دستگاه‌ها</p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-7 text-white/90 text-center max-w-md">
            برای استفاده از امکانات برنامه، وارد حساب خود شوید یا ثبت‌نام کنید. اتصال امن با Supabase و همگام‌سازی لحظه‌ای دستگاه‌ها.
          </p>
        </div>
        {/* Auth (right) */}
        <div className="flex items-center justify-center h-full w-full bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm" dir="rtl">
          <Card className="w-full max-w-md shadow-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <CardHeader className="flex flex-col gap-1">
              <h3 className="text-xl font-bold">ورود / ثبت‌نام</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">به حساب خود وارد شوید</p>
            </CardHeader>
            <CardBody>
              {children}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
