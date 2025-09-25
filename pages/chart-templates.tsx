"use client";

import dynamic from "next/dynamic";
import { SignedIn, SignedOut } from "@clerk/nextjs";

const ScreenshotPresetsPanel = dynamic(() => import("@/components/ScreenshotPresetsPanel").then(m => m.default), { ssr: false });

export default function ChartTemplatesPage() {
  const desktopMode = (() => {
    const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || "0").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  })();
  if (desktopMode) {
    // In desktop mode, ClerkProvider is disabled; render content directly
    return <ScreenshotPresetsPanel />;
  }
  return (
    <>
      <SignedIn>
        <ScreenshotPresetsPanel />
      </SignedIn>
      <SignedOut>{/* Redirected by client navigation */}</SignedOut>
    </>
  );
}
