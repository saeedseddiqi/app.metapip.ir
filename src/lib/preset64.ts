// Minimal preset64 utilities for MetaPip
// Provides TVPreset type and encodePreset64 used by PresetBuilder

export interface TVPreset {
  theme?: "dark" | "light";
  interval?: number | string;
  style?: number; // TradingView chart style, 1=candle
  timezone?: string;
  hide_side_toolbar?: boolean;
  hide_top_toolbar?: boolean;
  allow_symbol_change?: boolean;
  withdateranges?: boolean;
  locale?: string;
  backgroundColor?: string;
  gridColor?: string;
  // High-level candle colors
  candleUpColor?: string;
  candleDownColor?: string;
  // Wick colors
  wickColor?: string; // up
  wickColorDown?: string; // down
  borderUpColor?: string;
  borderDownColor?: string;
  // Advanced widget overrides and studies
  overrides?: Record<string, any>;
  studies_overrides?: Record<string, any>;
  studies?: Array<{ type?: string; inputs?: any[] } | string>;
  showLegend?: boolean;
  showWatermark?: boolean;
  volumeOverlay?: boolean;
  // Allow extra fields for forward compat
  [key: string]: any;
}

export function encodePreset64(obj: any): string {
  try {
    const json = JSON.stringify(obj ?? {});
    // Prefer Buffer when available (Node/SSR). In browsers, fall back below.
    const B: any = (globalThis as any).Buffer as any;
    if (B?.from) {
      return B.from(json, "utf-8").toString("base64");
    }
    // Fallback: Browser path with Unicode-safe encoding
    const g: any = globalThis as any;
    if (typeof g.TextEncoder === "function" && typeof g.btoa === "function") {
      const u8 = new g.TextEncoder().encode(json);
      let bin = "";
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      return g.btoa(bin);
    }
    return "";
  } catch {
    return "";
  }
}
