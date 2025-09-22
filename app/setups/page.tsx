"use client";

import dynamic from "next/dynamic";
import { SignedIn, SignedOut, SignIn } from "@clerk/nextjs";

const SetupManager = dynamic(() => import("@/components/SetupManager").then(m => m.default), { ssr: false });

export default function SetupsPage() {
  return (
    <>
      <SignedIn>
        <SetupManager />
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center gap-4 py-10">
          <h2 className="text-xl font-semibold">برای مدیریت ستاپ‌ها وارد شوید</h2>
          <div className="max-w-md w-full">
            <SignIn routing="hash" signUpUrl="/sign-up" afterSignInUrl="/dashboard" />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
