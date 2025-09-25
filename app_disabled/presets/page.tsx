"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PresetsPage() {
  const router = useRouter();
  useEffect(() => {
    try { router.replace("/chart-templates"); } catch {}
  }, [router]);
  return null;
}
