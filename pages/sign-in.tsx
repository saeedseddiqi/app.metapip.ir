"use client";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6" dir="ltr">
      <SignIn routing="hash" signUpUrl="/sign-up" afterSignInUrl="/dashboard" />
    </div>
  );
}
