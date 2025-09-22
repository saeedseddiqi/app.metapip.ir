import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile, remove } from "@tauri-apps/plugin-fs";

/**
 * Persistent Supabase session token manager for Tauri.
 * - Stores the access_token in app data dir under session.token (or session.<accountId>.token)
 * - Reads token on startup; deletes it on real logout.
 * - This file is also consumed by the Python MetaPip service which watches the same directory.
 */

export type SessionToken = {
  access_token: string;
  // Optional: future fields (refresh_token, expires_at) can be added
};

function parseBool(v: any, def: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return def;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return def;
}

// Enable file persistence? Default: production=true, dev=false (to avoid noisy warnings)
export function isTokenFileEnabled(): boolean {
  const explicit = process.env.NEXT_PUBLIC_TOKEN_FILE;
  const disabled = process.env.NEXT_PUBLIC_DISABLE_TOKEN_FILE;
  const byDisable = parseBool(disabled, false);
  const byEnable = parseBool(explicit, typeof window !== "undefined" ? (process.env.NODE_ENV === "production") : true);
  // If disabled flag set, it wins
  if (disabled !== undefined) return !byDisable;
  // Otherwise use explicit enable or default by env
  return byEnable;
}

function tokenFilename(accountId?: string): string {
  return accountId ? `session.${accountId}.token` : "session.token";
}

async function ensureDir(dir: string) {
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
}

export async function getSessionDir(): Promise<string> {
  // Allow override via .env for development or custom paths
  const override = process.env.NEXT_PUBLIC_TOKEN_DIR;
  if (override && override.trim().length > 0) {
    return override.trim();
  }
  // Tauri appDataDir already resolves to the app identifier (com.metapip)
  return await appDataDir();
}

export async function getTokenPath(accountId?: string): Promise<string> {
  const dir = await getSessionDir();
  return await join(dir, tokenFilename(accountId));
}

export async function saveToken(accessToken: string, accountId?: string): Promise<void> {
  // If file persistence disabled, save to localStorage and return silently
  if (!isTokenFileEnabled()) {
    try { if (typeof window !== "undefined") window.localStorage.setItem("metapip.sessionToken", JSON.stringify({ access_token: accessToken })); } catch {}
    return;
  }
  try {
    const dir = await getSessionDir();
    await ensureDir(dir);
    const path = await getTokenPath(accountId);
    const payload: SessionToken = { access_token: accessToken };
    await writeTextFile(path, JSON.stringify(payload), { append: false });
  } catch {
    // Fall back silently to localStorage to avoid noisy warnings in dev
    try { if (typeof window !== "undefined") window.localStorage.setItem("metapip.sessionToken", JSON.stringify({ access_token: accessToken })); } catch {}
  }
}

export async function loadToken(accountId?: string): Promise<string | null> {
  // Try file first if enabled
  if (isTokenFileEnabled()) {
    const path = await getTokenPath(accountId);
    if (await exists(path)) {
      try {
        const txt = await readTextFile(path);
        if (!txt) return null;
        if (txt.trim().startsWith("{")) {
          const obj = JSON.parse(txt) as SessionToken;
          return obj.access_token ?? null;
        }
        return txt.trim();
      } catch {}
    }
  }
  // Fallback to localStorage
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("metapip.sessionToken");
      if (!raw) return null;
      const obj = JSON.parse(raw) as SessionToken;
      return obj.access_token ?? null;
    }
  } catch {}
  return null;
}

export async function removeToken(accountId?: string): Promise<void> {
  try {
    const path = await getTokenPath(accountId);
    if (await exists(path)) {
      await remove(path);
    }
  } catch {}
  try { if (typeof window !== "undefined") window.localStorage.removeItem("metapip.sessionToken"); } catch {}
}
