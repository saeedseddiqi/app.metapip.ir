import React from 'react';
import dynamic from 'next/dynamic';
import { SignedIn, SignedOut, SignIn } from '@clerk/nextjs';
import { useClerkSupabaseSession } from '@/lib/auth/useClerkSupabaseSession';

const Dashboard = dynamic(() => import('@/components/Dashboard').then(m => m.Dashboard), { ssr: false });

// cleaned up: removed debug/test helpers and tauri wrappers

export default function DashboardPage() {
  const desktopMode = (() => {
    const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || '0').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  })();
  // Ensure client-side Supabase session when enabled (web only)
  if (!desktopMode) {
    try { useClerkSupabaseSession(); } catch {}
  }

  // Minimal render only
  if (desktopMode) {
    return <Dashboard />;
  }

  return (
    <>
      <SignedIn>
        <Dashboard />
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center gap-4 py-10">
          <h2 className="text-xl font-semibold">برای مشاهده داشبورد وارد شوید</h2>
          <div className="max-w-md w-full">
            <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
