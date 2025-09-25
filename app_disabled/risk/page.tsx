"use client";

import dynamic from "next/dynamic";
import { SignedIn, SignedOut } from "@clerk/nextjs";

const RiskSettings = dynamic(() => import("@/components/RiskSettings").then(m => m.RiskSettings), { ssr: false });

export default function RiskPage() {
  const desktopMode = (() => {
    const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();
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
