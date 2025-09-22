import type { Metadata } from "next";
import type { ReactNode } from "react";
import HeaderShell from "./HeaderShell";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "./providers";
import "./globals.css";
// ClerkProvider is now provided inside Providers (client) after runtime config loads

export const metadata: Metadata = {
  title: "MetaPip – متاپیپ",
  description: "MetaPip Desktop/Web UI powered by Next.js",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
            <body className="bg-gray-50 text-gray-900 dark:bg-zinc-900 dark:text-zinc-100">
        <SpeedInsights />
        <Providers>
          <main className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header visibility is controlled inside HeaderShell (client) */}
            <HeaderShell />
            <section>
              {children}
            </section>
          </main>
        </Providers>
      </body>
    </html>
  );
}

