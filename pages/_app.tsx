// pages/_app.tsx
import type { AppProps } from 'next/app';
import React from 'react';
import '@/styles/globals.css';
import HeaderShell from '@/pages-compat/HeaderShell';
import { Providers } from '@/pages-compat/Providers';
import { Analytics } from '@vercel/analytics/react';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <HeaderShell />
      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <Component {...pageProps} />
      </main>
      <Analytics />
    </Providers>
  );
}
