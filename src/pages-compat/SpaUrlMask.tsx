"use client";
import * as React from "react";
import { useRouter } from "next/router";

// Keeps the visible URL at "/" even when navigating between Pages Router routes.
// This provides a "single URL" SPA feel at app.metapip.ir while still using Next pages under the hood.
export default function SpaUrlMask() {
  const router = useRouter();

  React.useEffect(() => {
    const mask = () => {
      try {
        if (typeof window !== "undefined" && window.location.pathname !== "/") {
          // Replace the current history entry to show only "/"
          window.history.replaceState(null, "", "/");
        }
      } catch {}
    };

    // Mask on mount and after each route change
    mask();
    router.events?.on("routeChangeComplete", mask);
    return () => {
      router.events?.off?.("routeChangeComplete", mask);
    };
  }, [router]);

  return null;
}
