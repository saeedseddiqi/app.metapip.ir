import * as React from 'react';
import dynamic from 'next/dynamic';
import { SignedIn } from '@clerk/nextjs';

const Settings = dynamic(() => import('@/components/Settings').then(m => m.Settings), { ssr: false });

export default function SettingsPage() {
  const desktopMode = (() => {
    const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || '0').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  })();

  if (desktopMode) {
    return <Settings />;
  }

  return (
    <>
      <SignedIn>
        <Settings />
      </SignedIn>
    </>
  );
}
