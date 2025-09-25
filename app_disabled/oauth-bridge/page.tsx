"use client";
import { useEffect, useState } from "react";

// A tiny bridge page that receives the Supabase OAuth redirect in the browser
// and forwards it to the desktop app via the custom deep link, then closes itself.
export default function OAuthBridge() {
  const [msg, setMsg] = useState("در حال بازگشت به برنامه…");

  useEffect(() => {
    try {
      const href = window.location.href;
      const u = new URL(href);
      const search = u.search || "";
      const hash = u.hash || "";
      const deep = `metapip://auth/callback${search}${hash}`;
      // Try to launch the desktop app
      window.location.href = deep;
      setMsg("لطفاً کمی صبر کنید…");
      // Attempt to close the window if it was opened via window.open
      const tryClose = () => {
        try {
          window.close();
        } catch {}
        try {
          // Some browsers allow this workaround
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          window.open('', '_self');
          window.close();
        } catch {}
      };
      // Give the OS a moment to handle the deep link, then close.
      setTimeout(tryClose, 800);
    } catch (e) {
      setMsg("خطا در پردازش بازگشت. می‌توانید این صفحه را ببندید.");
    }
  }, []);

  return (
    <main className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="text-center space-y-2">
        <div className="text-lg font-medium">MetaPip</div>
        <div className="text-sm opacity-80">{msg}</div>
        <div className="text-xs opacity-60">اگر صفحه بسته نشد، آن را به صورت دستی ببندید.</div>
      </div>
    </main>
  );
}
