"use client";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex" dir="ltr">
      {/* Left column: Clerk SignUp form */}
      <div className="w-full max-w-md border-r bg-white dark:bg-zinc-900 p-6 flex items-start justify-center">
        <SignUp routing="hash" signInUrl="/sign-in" afterSignUpUrl="/dashboard?signup=success" />
      </div>

      {/* Right column: brand/intro panel (hidden on small screens) */}
      <div className="hidden md:flex flex-1 items-center justify-center p-8 bg-emerald-700 text-white">
        <div className="max-w-lg space-y-4 text-center" dir="rtl">
          <h1 className="text-3xl font-bold">MetaPip</h1>
          <p className="text-sm/6 opacity-90">
            حساب کاربری جدید بسازید و از امکانات کامل MetaPip استفاده کنید.
          </p>
        </div>
      </div>
    </div>
  );
}
