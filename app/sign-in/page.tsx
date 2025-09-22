"use client";
import { SignIn } from "@clerk/nextjs";
import { openHostedSignIn } from "@/lib/auth/deepLink";
import { isDesktopMode } from "@/lib/runtime/config";

export default function Page() {
  const desktopMode = isDesktopMode();
  const onBrowserLogin = async () => {
    try {
      await openHostedSignIn("metapip://auth/callback");
    } catch (e) {
      console.warn("[DeepLink] openHostedSignIn failed", e);
    }
  };
  return (
    <div className="min-h-[calc(100vh-4rem)] flex" dir="ltr">
      {/* Left column: Clerk SignIn form */}
      <div className="w-full max-w-md border-r bg-white dark:bg-zinc-900 p-6 flex flex-col gap-4 items-start justify-start">
        <button
          onClick={onBrowserLogin}
          className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
        >
          ورود در مرورگر (Deep Link)
        </button>
        {!desktopMode && (
          <SignIn routing="hash" signUpUrl="/sign-up" afterSignInUrl="/dashboard" />
        )}
      </div>

      {/* Right column: brand/intro panel (hidden on small screens) */}
      <div className="hidden md:flex flex-1 items-center justify-center p-8 bg-emerald-700 text-white">
        <div className="max-w-lg space-y-4 text-center" dir="rtl">
          <h1 className="text-3xl font-bold">MetaPip</h1>
          <p className="text-sm/6 opacity-90">
            یک داشبورد معاملات سفارشی برای مدیریت دستگاه‌ها، کنترل ریسک، و همگام‌سازی ایمن.
          </p>
        </div>
      </div>
    </div>
  );
}
