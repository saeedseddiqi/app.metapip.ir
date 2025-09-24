"use client";

// Lightweight desktop env loader for Tauri runtime.
// - Caches the env map in window.__MP_ENV__ to keep consumers synchronous
// - Exposes a loader and a synchronous reader

export type PublicEnv = Record<string, string>;

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

export function readDesktopEnv(): PublicEnv {
  if (typeof window === "undefined") return {};
  const w = window as any;
  return (w.__MP_ENV__ as PublicEnv) || {};
}

export async function loadDesktopEnv(): Promise<PublicEnv> {
  if (!isTauri()) return {};
  try {
    const core = await import("@tauri-apps/api/core");
    const json = await core.invoke<string>("get_public_envs");
    const envs: PublicEnv = JSON.parse(json || "{}");
    // Cache globally for synchronous consumers
    (window as any).__MP_ENV__ = envs;
    return envs;
  } catch {
    return {};
  }
}
