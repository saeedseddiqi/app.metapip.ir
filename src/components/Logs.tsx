import React from "react";
import { formatTime } from "../lib/utils";
import { listen } from "@tauri-apps/api/event";

export const Logs: React.FC = () => {
  const [logs, setLogs] = React.useState<string[]>([
    `[${formatTime(new Date())}] برنامه اجرا شد`,
  ]);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = React.useState<"all" | "errors">("all");

  const clear = () => setLogs([]);

  const isErrorLine = (line: string) => {
    // line format: [timestamp] <payload>, where payload can start with [E]/[O]/[I]
    const idx = line.indexOf("] ");
    if (idx === -1) return false;
    const rest = line.slice(idx + 2);
    return rest.startsWith("[E]");
  };

  const filteredLogs = React.useMemo(() => {
    if (filter === "errors") return logs.filter(isErrorLine);
    return logs;
  }, [logs, filter]);

  const copyAll = async () => {
    const text = logs.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      console.log("[Logs] Copied all logs to clipboard.");
    } catch (e) {
      // Fallback method
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-10000px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        console.log("[Logs] Copied all logs via fallback.");
      } catch (err) {
        console.warn("[Logs] Failed to copy logs:", err);
      }
    }
  };

  React.useEffect(() => {
    // StrictMode-safe subscription: ensure we always clean up even if the
    // effect is immediately torn down before the promise resolves.
    let active = true;
    let disposeLog: undefined | (() => void);
    let disposeStarted: undefined | (() => void);
    (async () => {
      try {
        const un = await listen<string>("python_log", (event) => {
          const line = (event.payload ?? "").toString();
          setLogs((prev) => [...prev, `[${formatTime(new Date())}] ${line}`]);
        });
        if (!active) {
          // Effect already cleaned up; immediately dispose.
          try { un(); } catch {}
          return;
        }
        disposeLog = un;
        // Also listen for process start events to show PID
        const un2 = await listen<number | string>("python_dev_started", (event) => {
          const pidStr = String(event.payload);
          setLogs((prev) => [...prev, `[${formatTime(new Date())}] [I] Python monitor started (pid=${pidStr})`]);
        });
        if (!active) {
          try { un2(); } catch {}
          return;
        }
        disposeStarted = un2;
      } catch (e) {
        console.warn("Failed to listen python_log:", e);
      }
    })();
    return () => {
      active = false;
      try { if (disposeLog) disposeLog(); } catch {}
      try { if (disposeStarted) disposeStarted(); } catch {}
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">گزارش رویدادها</h2>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 rounded px-2 py-1 card-surface border border-gray-200 dark:border-zinc-700">
            <span className="text-sm">فیلتر:</span>
            <button
              onClick={() => setFilter("all")}
              className={(filter === "all" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100") + " px-2 py-1 rounded text-sm"}
            >همه</button>
            <button
              onClick={() => setFilter("errors")}
              className={(filter === "errors" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100") + " px-2 py-1 rounded text-sm"}
            >فقط خطاها</button>
          </div>
          <button onClick={copyAll} className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">کپی همه</button>
          <button onClick={clear} className="px-3 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 rounded">پاک کردن</button>
        </div>
      </div>
      <div ref={scrollRef} className="h-64 overflow-auto rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-sm font-mono card-surface" dir="ltr">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-600 dark:text-zinc-300">هنوز رویدادی ثبت نشده است.</div>
        ) : (
          <ul className="space-y-1">
            {filteredLogs.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
;
