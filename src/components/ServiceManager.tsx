import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, PlayIcon, StopIcon } from "@heroicons/react/24/outline";

export const ServiceManager: React.FC = () => {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [running, setRunning] = React.useState(false);
  const [statusText, setStatusText] = React.useState("");

  async function fetchStatus() {
    try {
      const s = await invoke<string>("python_dev_status");
      setStatusText(s || "");
      const isRun = /^running$/i.test(s.trim());
      setRunning(isRun);
    } catch (e: any) {
      setStatusText(String(e?.message || e || ""));
      setRunning(false);
    }
  }

  React.useEffect(() => {
    fetchStatus();
    const id = setInterval(() => {
      fetchStatus();
    }, 3000);
    return () => clearInterval(id);
  }, []);

  async function run(cmd: "start_python_dev" | "stop_python_dev") {
    try {
      setBusy(cmd);
      setResult(null);
      const text = (await invoke<string>(cmd)) || "";
      const isError = text.trim().startsWith("ERR:");
      setResult({ kind: isError ? "error" : "success", text });
    } catch (e: any) {
      setResult({ kind: "error", text: String(e?.message || e || "خطای ناشناخته") });
    } finally {
      setBusy(null);
      // refresh status after operation
      fetchStatus();
    }
  }

  function parseLines(raw: string): Array<{ type: "ok" | "error" | "info" | "warn"; text: string }>{
    const out: Array<{ type: "ok" | "error" | "info" | "warn"; text: string }> = [];
    const lines = (raw || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      let type: "ok" | "error" | "info" | "warn" = "info";
      if (/^ERR:/i.test(line) || /FAILED/i.test(line)) type = "error";
      else if (/^OK:/i.test(line) || /SUCCESS/i.test(line)) type = "ok";
      // Special handling for common Windows error 193
      if (/error\s*193/i.test(line)) {
        type = "error";
        out.push({ type, text: "خطا ۱۹۳: فایل اجرایی سرویس نامعتبر است یا نقل‌قول مسیر (binPath) اشتباه است. مطمئن شوید binPath به یک سرویس ۶۴-بیتی معتبر اشاره می‌کند و مسیر به‌درستی داخل کوتیشن قرار گرفته است." });
      }
      out.push({ type, text: line });
    }
    if (out.length === 0 && raw) out.push({ type: "info", text: raw });
    return out;
  }

  return (
    <div className="p-4 rounded border border-gray-200 dark:border-zinc-700 card-surface">
      <div className="mb-3">
        <h3 className="text-lg font-medium">مدیر بک‌اند</h3>
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          اجرای سرویس بک‌اند بر اساس متغیر محیطی <code>BACKEND_MODE</code> (dev = Python ، prod = EXE)
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => run("start_python_dev")}
          disabled={!!busy || running}
          className="px-3 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <PlayIcon className="h-4 w-4" />
          <span>{busy === "start_python_dev" ? "در حال شروع…" : "شروع"}</span>
        </button>
        <button
          onClick={() => run("stop_python_dev")}
          disabled={!!busy || !running}
          className="px-3 py-2 rounded text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <StopIcon className="h-4 w-4" />
          <span>{busy === "stop_python_dev" ? "در حال توقف…" : "توقف"}</span>
        </button>

        <div className={"ml-auto text-xs px-2 py-1 rounded " + (running ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300")}>
          {running ? "در حال اجرا" : (statusText ? statusText : "متوقف")}
        </div>
      </div>

      {result && (
        <div role="status" aria-live="polite" className="mt-3 space-y-2">
          {parseLines(result.text).map((m, i) => (
            <div
              key={i}
              className={
                "flex items-start gap-2 rounded p-2 text-sm " +
                (m.type === "ok"
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : m.type === "error"
                  ? "bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
                  : m.type === "warn"
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                  : "bg-zinc-50 text-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-200")
              }
            >
              <span className="mt-0.5">
                {m.type === "ok" ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : m.type === "error" ? (
                  <ExclamationTriangleIcon className="h-5 w-5" />
                ) : (
                  <InformationCircleIcon className="h-5 w-5" />
                )}
              </span>
              <span className="whitespace-pre-wrap" dir="auto">{m.text}</span>
            </div>
          ))}
        </div>
      )}

      {statusText && (
        <div className="mt-2 text-xs text-zinc-500 whitespace-pre-wrap flex items-start gap-2">
          <InformationCircleIcon className="h-4 w-4 mt-0.5" />
          <span dir="auto">{statusText}</span>
        </div>
      )}
    </div>
  );
};
