"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DiagnosticsRedirect() {
  const router = useRouter();
  useEffect(() => {
    try { router.replace("/diagnostics"); } catch {}
  }, [router]);
  return null;
}
