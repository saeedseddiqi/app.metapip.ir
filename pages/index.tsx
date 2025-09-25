import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { openHostedSignIn } from '@/lib/auth/deepLink';
import { SignedIn, SignedOut, useAuth } from '@clerk/nextjs';

export default function IndexPage() {
  const router = useRouter();
  const desktopMode = (() => {
    const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || '0').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  })();

  if (desktopMode) {
    const onLogin = async () => { try { await openHostedSignIn('metapip://auth/callback'); } catch {} };
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div>برای ادامه وارد شوید.</div>
          <button onClick={onLogin} className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">ورود</button>
        </div>
      </div>
    );
  }

  const { isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) router.replace('/dashboard');
    else router.replace('/sign-in');
  }, [isLoaded, isSignedIn, router]);

  return (
    <>
      <SignedIn>
        <div className="p-6 text-center">در حال هدایت…</div>
      </SignedIn>
      <SignedOut>
        <div className="p-6 text-center">در حال هدایت به صفحه ورود…</div>
      </SignedOut>
    </>
  );
}
