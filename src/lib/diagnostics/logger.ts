"use client";

export type LogLevel = "debug" | "info" | "warn" | "error" | "success";
export interface DiagLog {
  id: string;
  ts: string; // ISO timestamp
  level: LogLevel;
  message: string;
  data?: any;
}

const storageKey = "diagnostics:logs";
const listeners = new Set<(logs: DiagLog[]) => void>();
let logs: DiagLog[] = [];

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(logs)); } catch {}
}

function load() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) logs = arr as DiagLog[];
    }
  } catch {}
}

function notify() {
  listeners.forEach((cb) => {
    try { cb([...logs]); } catch {}
  });
}

export function subscribe(cb: (logs: DiagLog[]) => void) {
  listeners.add(cb);
  cb([...logs]);
  return () => listeners.delete(cb);
}

export function clear() {
  logs = [];
  persist();
  notify();
}

export function add(level: LogLevel, message: string, data?: any) {
  const entry: DiagLog = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    ts: new Date().toISOString(),
    level,
    message,
    data,
  };
  logs.push(entry);
  if (logs.length > 500) logs = logs.slice(-500);
  persist();
  notify();
}

export function getAll(): DiagLog[] { return [...logs]; }

// Initialize from storage on first import
try { load(); } catch {}
