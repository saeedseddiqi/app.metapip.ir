"use client";
import DiagnosticsChecklist from "@/components/DiagnosticsChecklist";
import EnvDebug from "@/components/EnvDebug";

export default function DiagnosticsPage() {
  return (
    <main className="p-4 space-y-4" dir="rtl">
      <EnvDebug />
      <DiagnosticsChecklist />
    </main>
  );
}
