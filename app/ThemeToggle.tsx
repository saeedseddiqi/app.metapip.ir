"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  // Avoid rendering icon until mounted to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure DOM classes match resolvedTheme (extra safety for Tauri/SSR)
  useEffect(() => {
    if (!mounted) return;
    try {
      const root = document.documentElement;
      const body = document.body;
      if (resolvedTheme === "dark") {
        root.classList.add("dark");
        root.setAttribute("data-theme", "dark");
        body?.classList?.add("dark");
      } else {
        root.classList.remove("dark");
        root.setAttribute("data-theme", "light");
        body?.classList?.remove("dark");
      }
    } catch {}
  }, [resolvedTheme, mounted]);

  return (
    <button
      type="button"
      onClick={() => {
        const isDark = resolvedTheme === "dark";
        setTheme(isDark ? "light" : "dark");
        // Apply immediately as a fallback to avoid any delay
        try {
          const root = document.documentElement;
          const body = document.body;
          if (isDark) {
            root.classList.remove("dark");
            root.setAttribute("data-theme", "light");
            body?.classList?.remove("dark");
          } else {
            root.classList.add("dark");
            root.setAttribute("data-theme", "dark");
            body?.classList?.add("dark");
          }
        } catch {}
      }}
      className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-700"
      aria-label="تغییر تم"
      title={resolvedTheme === "dark" ? "تغییر به روشن" : "تغییر به تیره"}
      suppressHydrationWarning
    >
      {mounted && resolvedTheme === "dark" ? (
        <SunIcon className="h-5 w-5" />
      ) : mounted ? (
        <MoonIcon className="h-5 w-5" />
      ) : (
        // Render neutral placeholder pre-hydration to avoid mismatch
        <span className="inline-block h-5 w-5" />
      )}
    </button>
  );
}
