import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";

export type EventRow = {
  id: string;
  created_at: string;
  event_type: string;
  account_id?: number | null;
  server?: string | null;
  data: Record<string, any>;
};

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "subscribed"
  | "reconnecting"
  | "closed"
  | "error";

/**
 * Subscribe to INSERT changes on public.events_stream via Supabase Realtime.
 * - onEvent: callback per new row
 * - filter: optional PostgREST filter string, e.g., "account_id=eq.70123937"
 * Returns { status, retries } for UI indicators.
 */
export function useEventsStream(
  onEvent: (row: EventRow) => void,
  filter?: string
): { status: RealtimeStatus; retries: number } {
  const [status, setStatus] = useState<RealtimeStatus>(
    isSupabaseConfigured ? "connecting" : "idle"
  );
  const [retries, setRetries] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const backoffRef = useRef<number>(1000); // start 1s
  const timerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    try {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } catch {}
    try {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    } catch {}
  }, []);

  const subscribe = useCallback(() => {
    if (!isSupabaseConfigured) return;
    setStatus((s) => (s === "idle" ? s : "connecting"));
    try {
      const ch = supabase
        .channel("events_stream")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events_stream",
            ...(filter ? { filter } : {}),
          } as any,
          (payload) => {
            const row = (payload as any).new as EventRow;
            if (row) onEvent(row);
          }
        )
        .subscribe((st) => {
          if (!mountedRef.current) return;
          if (st === "SUBSCRIBED") {
            setStatus("subscribed");
            setRetries(0);
            backoffRef.current = 1000; // reset backoff
          } else if (st === "CLOSED") {
            setStatus("closed");
            scheduleReconnect();
          } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
            setStatus("error");
            scheduleReconnect();
          }
        });
      channelRef.current = ch;
    } catch (e) {
      setStatus("error");
      scheduleReconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, onEvent]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    setStatus("reconnecting");
    setRetries((r) => r + 1);
    const delay = Math.min(backoffRef.current, 30000); // cap 30s
    backoffRef.current = Math.min(backoffRef.current * 2, 30000);
    try {
      if (timerRef.current) clearTimeout(timerRef.current);
    } catch {}
    timerRef.current = setTimeout(() => {
      cleanup();
      subscribe();
    }, delay);
  }, [cleanup, subscribe]);

  useEffect(() => {
    mountedRef.current = true;
    if (!isSupabaseConfigured) {
      setStatus("idle");
      return () => {};
    }
    subscribe();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, onEvent]);

  return { status, retries };
}
