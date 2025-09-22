import { useEffect, useRef } from "react";
import type { TVPreset } from "../lib/preset64";
import { loadTVScript } from "../lib/tvLoader";

interface ChartPreviewProps {
  preset: TVPreset;
  symbol?: string; // default EURUSD
  height?: number; // px
}

export default function ChartPreview({ preset, symbol = "EURUSD", height = 420 }: ChartPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      loadTVScript(symbol, preset, containerRef.current);
    } catch {}
  }, [symbol, preset]);

  return (
    <div className="w-full border border-gray-300 dark:border-zinc-700 rounded overflow-hidden" style={{ height }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
