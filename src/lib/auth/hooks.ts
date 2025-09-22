"use client";
import * as React from "react";
import { getDeviceInfo } from "./device";
import { registerDevice, heartbeat } from "./functions";
import { supabase } from "@/lib/supabase";

export function useClerkSyncAndDevice() {
  const hbRef = React.useRef<number | null>(null);
  const deviceIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cleanupListeners: (() => void) | null = null;
    const start = async () => {
      try {
        const dev = await getDeviceInfo();
        deviceIdRef.current = dev.device_id;
        await registerDevice({ ...dev, realtime: true });
        if (hbRef.current) window.clearInterval(hbRef.current);
        hbRef.current = window.setInterval(async () => {
          try { await heartbeat(dev.device_id, "online", true); } catch {}
        }, 20_000);

        const offline = async () => {
          try {
            const did = deviceIdRef.current;
            if (!did) return;
            await heartbeat(did, "offline", false);
          } catch {}
        };
        const onBeforeUnload = () => { void offline(); };
        const onVisibility = () => { if (document.visibilityState === "hidden") void offline(); };
        window.addEventListener("beforeunload", onBeforeUnload);
        document.addEventListener("visibilitychange", onVisibility);
        cleanupListeners = () => {
          window.removeEventListener("beforeunload", onBeforeUnload);
          document.removeEventListener("visibilitychange", onVisibility);
        };
      } catch (e) {
        console.warn("[DeviceSync] failed:", e);
      }
    };

    // Run when Supabase session becomes available; stop when session is cleared
    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      try {
        if (session && session.user) {
          void start();
        } else {
          if (hbRef.current) window.clearInterval(hbRef.current);
          if (cleanupListeners) { cleanupListeners(); cleanupListeners = null; }
        }
      } catch {}
    });
    return () => {
      try { sub.subscription.unsubscribe(); } catch {}
      if (hbRef.current) window.clearInterval(hbRef.current);
      if (cleanupListeners) { cleanupListeners(); cleanupListeners = null; }
    };
  }, []);
}

