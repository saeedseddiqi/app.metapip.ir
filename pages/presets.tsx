"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";

export default function PresetsRedirect() {
  const router = useRouter();
  useEffect(() => {
    try { router.replace("/chart-templates"); } catch {}
  }, [router]);
  return null;
}
