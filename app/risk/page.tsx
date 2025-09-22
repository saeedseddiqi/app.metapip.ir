"use client";

import dynamic from "next/dynamic";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { isDesktopMode } from "@/lib/runtime/config";

const RiskSettings = dynamic(() => import("@/components/RiskSettings").then(m => m.RiskSettings), { ssr: false });

export default function RiskPage() {
  const desktopMode = isDesktopMode();
  if (desktopMode) {
    return (
      <div className="space-y-6" dir="rtl">
        <RiskSettings />
      </div>
    );
  }
  return (
    <>
      <SignedIn>
        <div className="space-y-6" dir="rtl">
          <RiskSettings />
        </div>
      </SignedIn>
      <SignedOut>
        <div className="p-4 text-sm opacity-80">برای مشاهده این بخش، ابتدا وارد حساب شوید.</div>
      </SignedOut>
    </>
  );
}
