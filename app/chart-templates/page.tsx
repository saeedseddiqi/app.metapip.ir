"use client";

import dynamic from "next/dynamic";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { isDesktopMode } from "@/lib/runtime/config";

const ScreenshotPresetsPanel = dynamic(() => import("@/components/ScreenshotPresetsPanel").then(m => m.default), { ssr: false });

export default function ChartTemplatesPage() {
  const desktopMode = isDesktopMode();
  if (desktopMode) {
    // In desktop mode, ClerkProvider is disabled; render content directly
    return <ScreenshotPresetsPanel />;
  }
  return (
    <>
      <SignedIn>
        <ScreenshotPresetsPanel />
      </SignedIn>
      <SignedOut>{/* Redirected by middleware */}</SignedOut>
    </>
  );
}
