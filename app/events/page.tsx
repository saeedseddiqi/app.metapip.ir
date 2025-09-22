"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import { isDesktopMode } from "@/lib/runtime/config";
import { Logs } from "@/components/Logs";
import { EventsStream } from "@/components/EventsStream";

export default function EventsPage() {
  const desktopMode = isDesktopMode();
  if (desktopMode) {
    // In desktop mode, ClerkProvider is disabled; render content directly
    return (
      <div className="space-y-8">
        <EventsStream />
        <Logs />
      </div>
    );
  }
  return (
    <>
      <SignedIn>
        <div className="space-y-8">
          <EventsStream />
          <Logs />
        </div>
      </SignedIn>
      <SignedOut>
        <div className="p-4 text-sm opacity-80">برای مشاهده این بخش، ابتدا وارد حساب شوید.</div>
      </SignedOut>
    </>
  );
}
