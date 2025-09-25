import type { AppProps } from 'next/app';
import React from 'react';
import '@/styles/globals.css';
import HeaderShell from '@/pages-compat/HeaderShell';
import { Providers } from '@/pages-compat/Providers';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <HeaderShell />
        <section>
          <Component {...pageProps} />
        </section>
      </main>
    </Providers>
  );
}
