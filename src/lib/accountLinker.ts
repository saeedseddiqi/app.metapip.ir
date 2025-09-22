import { invoke } from "@tauri-apps/api/core";

// Minimal event bus for link notifications
export type LinkEvent = { kind: "success" | "error"; message: string };
let lastEvent: LinkEvent | null = null;
const subs = new Set<(e: LinkEvent) => void>();
export function subscribeLinkEvents(cb: (e: LinkEvent) => void) {
  subs.add(cb);
  return () => subs.delete(cb);
}
function emit(e: LinkEvent) {
  lastEvent = e;
  subs.forEach((s) => {
    try { s(e); } catch {}
  });
}
export function getLastLinkEvent() { return lastEvent; }

const LINKED_KEY = "mc_account_linked";
export function isAccountLinked(): boolean {
  try { return localStorage.getItem(LINKED_KEY) === "true"; } catch { return false; }
}
export function setAccountLinked(v: boolean) {
  try { localStorage.setItem(LINKED_KEY, v ? "true" : "false"); } catch {}
}

export function isLinkUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "metapip:") return false;
    const host = u.hostname || u.host;
    return host === "link"; // metapip://link?token=...
  } catch {
    return false;
  }
}

export function extractTokenFromLink(raw: string): string | null {
  try {
    const u = new URL(raw);
    const token = u.searchParams.get("token");
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function extractAccountFromLink(raw: string): string | null {
  try {
    const u = new URL(raw);
    const acc = u.searchParams.get("account");
    return acc && acc.length > 0 ? acc : null;
  } catch {
    return null;
  }
}

export async function handleLinkUrl(url: string) {
  const token = extractTokenFromLink(url);
  const accountId = extractAccountFromLink(url);
  if (!token) {
    emit({ kind: "error", message: "نشانی لینک فاقد توکن است" });
    return { ok: false, message: "توکن موجود نیست" };
  }
  try {
    const res = await invoke<string>("link_account", { token, account_id: accountId });
    const isError = res.trim().startsWith("ERR:");
    if (!isError) setAccountLinked(true);
    emit({ kind: isError ? "error" : "success", message: res });
    return { ok: !isError, message: res };
  } catch (e: any) {
    const msg = String(e?.message || e || "خطای ناشناخته");
    emit({ kind: "error", message: msg });
    return { ok: false, message: msg };
  }
}

let initDone = false;
export async function initAccountLinker() {
  if (initDone) return;
  initDone = true;
  // No-op: Deep link handling is centralized in AuthPanel. This initializer intentionally does nothing.
}

