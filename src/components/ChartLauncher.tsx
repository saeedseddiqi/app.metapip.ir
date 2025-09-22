import React from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

export const ChartLauncher: React.FC = () => {
  const [symbol, setSymbol] = React.useState("");
  const [preset, setPreset] = React.useState("default");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const launch = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Basic TradingView URL pattern
      const url = `https://metacenter.vercel.app/chart/?symbol=${encodeURIComponent(symbol.trim())}`;
      await openUrl(url);
    } catch (e: any) {
      setError(e?.message ?? "باز کردن چارت ناموفق بود");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 p-4 rounded border border-gray-200 dark:border-zinc-700">
      <h2 className="text-xl font-semibold">راه‌انداز چارت</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="مثلاً: EURUSD, BTCUSDT, AAPL"
          className="px-3 py-2 rounded border border-gray-300 dark:border-zinc-700 bg-transparent"
          dir="ltr"
        />
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="px-3 py-2 rounded border border-gray-300 dark:border-zinc-700 bg-transparent"
        >
          <option value="default">پیش‌فرض</option>
          <option value="scalping">اسکالپینگ</option>
          <option value="swing">سوئینگ</option>
        </select>
        <button
          onClick={launch}
          disabled={!symbol.trim() || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "در حال باز کردن..." : "باز کردن چارت"}
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
};
