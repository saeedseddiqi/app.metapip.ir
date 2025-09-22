"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type ScreenshotPresetRow = {
  id: number;
  user_id: string;
  name: string;
  preset64: string;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function decodePreset64<T = any>(preset64: string): T | null {
  try {
    return JSON.parse(atob(preset64)) as T;
  } catch {
    return null;
  }
}

// List all user's presets
export async function fetchUserScreenshotPresets(userId?: string): Promise<ScreenshotPresetRow[]> {
  const uid = userId || (await supabase.auth.getUser()).data.user?.id || null;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("presets")
    .select("id,user_id,name,preset64,is_active,created_at,updated_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ScreenshotPresetRow[]) || [];
}

// Fetch user's active preset (is_active=true)
export async function fetchActivePreset(userId?: string): Promise<ScreenshotPresetRow | null> {
  const uid = userId || (await supabase.auth.getUser()).data.user?.id || null;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("presets")
    .select("id,user_id,name,preset64,is_active,created_at,updated_at")
    .eq("user_id", uid)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error as any;
  return (data as ScreenshotPresetRow) || null;
}

// Fetch global default preset by name 'Default'. Assumes one public row exists.
export async function fetchGlobalDefaultPreset(): Promise<ScreenshotPresetRow | null> {
  const { data, error } = await supabase
    .from("presets")
    .select("id,user_id,name,preset64,is_active,created_at,updated_at")
    .eq("name", "Default")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as ScreenshotPresetRow) || null;
}

// Effective preset: user's active preset, otherwise global 'Default'
export async function fetchEffectivePreset(userId?: string): Promise<ScreenshotPresetRow | null> {
  const active = await fetchActivePreset(userId);
  if (active) return active;
  return await fetchGlobalDefaultPreset();
}

// Hook (optional) to get effective preset reactively
export function useEffectivePreset(userId?: string) {
  const [preset, setPreset] = useState<ScreenshotPresetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await fetchEffectivePreset(userId);
        if (!mounted) return;
        setPreset(p);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load preset");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [userId]);
  return { preset, loading, error } as const;
}

// Backward-compat aliases
export async function fetchDefaultScreenshotPreset(): Promise<ScreenshotPresetRow | null> {
  return await fetchGlobalDefaultPreset();
}
export function useDefaultScreenshotPreset(userId?: string) {
  // Historically meant user's default; now we return effective global default
  const [preset, setPreset] = useState<ScreenshotPresetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await fetchGlobalDefaultPreset();
        if (!mounted) return;
        setPreset(p);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load preset");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [userId]);
  return { preset, loading, error } as const;
}
