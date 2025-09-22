import type { TVPreset } from "./preset64";

function normalizePreset(p: TVPreset): TVPreset {
  const validIntervals = ["1","3","5","15","30","60","120","240","D","W","M"];
  const intervalStr = p?.interval ? String(p.interval) : undefined;
  const interval = intervalStr && validIntervals.includes(intervalStr) ? intervalStr : undefined;
  const styleNum = Number(p?.style);
  const style = [1,2,3,4,5].includes(styleNum) ? styleNum : undefined;
  const theme = p?.theme === "light" ? "light" : p?.theme === "dark" ? "dark" : undefined;
  return { ...p, interval, style, theme } as TVPreset;
}

export function loadTVScript(symbol: string, preset: TVPreset, container: HTMLElement) {
  const embedSymbol = symbol;
  const presetNorm = normalizePreset(preset);
  const intervalOpt = presetNorm.interval ? String(presetNorm.interval) : undefined;
  const themeOpt = presetNorm.theme === "light" || presetNorm.theme === "dark" ? presetNorm.theme : undefined;
  const styleOpt = presetNorm.style;
  const timezone = presetNorm?.timezone ?? "Etc/UTC";
  const hide_side_toolbar = typeof presetNorm?.hide_side_toolbar === "boolean" ? presetNorm.hide_side_toolbar : true;
  const hide_top_toolbar = typeof presetNorm?.hide_top_toolbar === "boolean" ? presetNorm.hide_top_toolbar : false;
  const allow_symbol_change = typeof presetNorm?.allow_symbol_change === "boolean" ? presetNorm.allow_symbol_change : true;
  const withdateranges = typeof presetNorm?.withdateranges === "boolean" ? presetNorm.withdateranges : true;
  const showLegend = typeof (presetNorm as any)?.showLegend === "boolean" ? (presetNorm as any).showLegend : true;
  const showWatermark = typeof (presetNorm as any)?.showWatermark === "boolean" ? (presetNorm as any).showWatermark : true;

  // Prepare container
  container.innerHTML = "";
  const inner = document.createElement("div");
  inner.id = `tv_chart_${Math.random().toString(36).slice(2)}`;
  inner.style.width = "100%";
  inner.style.height = "100%";
  container.appendChild(inner);

  // Load tv.js once
  const ensureScript = () => new Promise<void>((resolve, reject) => {
    const w = window as any;
    if (w.TradingView && typeof w.TradingView.widget === "function") return resolve();
    const existing = document.querySelector('script[data-tvjs="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("tv.js failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-tvjs", "true");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("tv.js failed to load"));
    document.head.appendChild(s);
  });

  const overridesIn = presetNorm?.overrides ?? {};
  const overrides: Record<string, any> = { ...overridesIn };

  // Background
  if (typeof presetNorm?.backgroundColor === "string" && presetNorm.backgroundColor.length > 0) {
    const bg = presetNorm.backgroundColor;
    overrides["paneProperties.background"] = bg;
  }
  // Grid
  if (typeof presetNorm?.gridColor === "string" && presetNorm.gridColor.length > 0) {
    overrides["paneProperties.vertGridProperties.color"] = presetNorm.gridColor;
    overrides["paneProperties.horzGridProperties.color"] = presetNorm.gridColor;
  }
  // Candle colors
  if (typeof presetNorm?.candleUpColor === "string" && presetNorm.candleUpColor.length > 0) {
    overrides["mainSeriesProperties.candleStyle.upColor"] = presetNorm.candleUpColor;
    overrides["mainSeriesProperties.candleStyle.borderUpColor"] = presetNorm.candleUpColor;
    overrides["mainSeriesProperties.hollowCandleStyle.upColor"] = presetNorm.candleUpColor;
    overrides["mainSeriesProperties.hollowCandleStyle.borderUpColor"] = presetNorm.candleUpColor;
    overrides["mainSeriesProperties.haStyle.upColor"] = presetNorm.candleUpColor;
    overrides["mainSeriesProperties.haStyle.borderUpColor"] = presetNorm.candleUpColor;
    overrides["mainSeriesProperties.barStyle.upColor"] = presetNorm.candleUpColor;
  }
  if (typeof presetNorm?.candleDownColor === "string" && presetNorm.candleDownColor.length > 0) {
    overrides["mainSeriesProperties.candleStyle.downColor"] = presetNorm.candleDownColor;
    overrides["mainSeriesProperties.candleStyle.borderDownColor"] = presetNorm.candleDownColor;
    overrides["mainSeriesProperties.hollowCandleStyle.downColor"] = presetNorm.candleDownColor;
    overrides["mainSeriesProperties.hollowCandleStyle.borderDownColor"] = presetNorm.candleDownColor;
    overrides["mainSeriesProperties.haStyle.downColor"] = presetNorm.candleDownColor;
    overrides["mainSeriesProperties.haStyle.borderDownColor"] = presetNorm.candleDownColor;
    overrides["mainSeriesProperties.barStyle.downColor"] = presetNorm.candleDownColor;
  }
  if (typeof (presetNorm as any)?.borderUpColor === "string" && (presetNorm as any).borderUpColor.length > 0) {
    const c = (presetNorm as any).borderUpColor as string;
    overrides["mainSeriesProperties.candleStyle.borderUpColor"] = c;
    overrides["mainSeriesProperties.hollowCandleStyle.borderUpColor"] = c;
    overrides["mainSeriesProperties.haStyle.borderUpColor"] = c;
  }
  if (typeof (presetNorm as any)?.borderDownColor === "string" && (presetNorm as any).borderDownColor.length > 0) {
    const c = (presetNorm as any).borderDownColor as string;
    overrides["mainSeriesProperties.candleStyle.borderDownColor"] = c;
    overrides["mainSeriesProperties.hollowCandleStyle.borderDownColor"] = c;
    overrides["mainSeriesProperties.haStyle.borderDownColor"] = c;
  }
  const wickUp = typeof presetNorm?.wickColor === "string" && presetNorm.wickColor.length > 0
    ? presetNorm.wickColor
    : typeof (presetNorm as any)?.wickUpColor === "string" && (presetNorm as any).wickUpColor.length > 0
      ? (presetNorm as any).wickUpColor
      : undefined;
  const wickDown = typeof presetNorm?.wickColorDown === "string" && presetNorm.wickColorDown.length > 0
    ? presetNorm.wickColorDown
    : typeof (presetNorm as any)?.wickDownColor === "string" && (presetNorm as any).wickDownColor.length > 0
      ? (presetNorm as any).wickDownColor
      : undefined;
  if (wickUp) {
    overrides["mainSeriesProperties.candleStyle.wickUpColor"] = wickUp;
    overrides["mainSeriesProperties.candleStyle.wickColor"] = wickUp;
    overrides["mainSeriesProperties.hollowCandleStyle.wickUpColor"] = wickUp;
    overrides["mainSeriesProperties.hollowCandleStyle.wickColor"] = wickUp;
    overrides["mainSeriesProperties.haStyle.wickUpColor"] = wickUp;
    overrides["mainSeriesProperties.haStyle.wickColor"] = wickUp;
  }
  if (wickDown) {
    overrides["mainSeriesProperties.candleStyle.wickDownColor"] = wickDown;
    overrides["mainSeriesProperties.hollowCandleStyle.wickDownColor"] = wickDown;
    overrides["mainSeriesProperties.haStyle.wickDownColor"] = wickDown;
  }
  const hasAnyCandleColors = (
    (typeof presetNorm?.candleUpColor === "string" && presetNorm.candleUpColor.length > 0) ||
    (typeof presetNorm?.candleDownColor === "string" && presetNorm.candleDownColor.length > 0) ||
    (typeof presetNorm?.wickColor === "string" && presetNorm.wickColor.length > 0) ||
    (typeof presetNorm?.wickColorDown === "string" && presetNorm.wickColorDown.length > 0)
  );
  if (!styleOpt && hasAnyCandleColors) {
    overrides["mainSeriesProperties.style"] = 1;
  }
  overrides["mainSeriesProperties.candleStyle.drawWick"] = true;
  overrides["mainSeriesProperties.candleStyle.drawBorder"] = true;
  overrides["paneProperties.legendProperties.showLegend"] = showLegend;
  overrides["symbolWatermarkProperties.visibility"] = showWatermark;

  // Build initial widget config
  const config: any = {
    container_id: inner.id,
    autosize: true,
    symbol: embedSymbol,
    timezone,
    hide_side_toolbar,
    hide_top_toolbar,
    allow_symbol_change,
    withdateranges,
    overrides,
    studies: [],
  };
  if (typeof presetNorm?.backgroundColor === "string" && presetNorm.backgroundColor.length > 0) {
    config.backgroundColor = presetNorm.backgroundColor;
  }
  if (typeof presetNorm?.gridColor === "string" && presetNorm.gridColor.length > 0) {
    config.gridColor = presetNorm.gridColor;
  }
  if (styleOpt) config.style = styleOpt;
  if (!styleOpt && hasAnyCandleColors) config.style = 1;
  if (intervalOpt) config.interval = intervalOpt;
  if (themeOpt) config.theme = themeOpt;
  if (presetNorm?.studies_overrides) config.studies_overrides = presetNorm.studies_overrides;

  ensureScript().then(() => {
    const w = window as any;
    // @ts-ignore
    const tv: any = new w.TradingView.widget(config);
    try { (w as any).__tvWidget = tv; } catch {}
    tv?.onChartReady?.(() => {
      try {
        const chartApi = (typeof tv?.activeChart === "function" ? tv.activeChart() : (typeof tv?.chart === "function" ? tv.chart() : undefined));
        if (typeof tv.applyOverrides === "function") tv.applyOverrides(overrides);
        if (chartApi && typeof chartApi.applyOverrides === "function") chartApi.applyOverrides(overrides);
        // Remove ALL existing studies first (widget may add defaults like Volume). Repeat a few times to catch late inits.
        const strongRemoveAll = () => {
          try {
            try { (chartApi as any)?.removeAllStudies?.(); } catch {}
            const list = (chartApi as any)?.getAllStudies?.() || [];
            list.forEach((st: any) => {
              try { (chartApi as any)?.removeStudy?.(st.id); } catch {}
              try { (chartApi as any)?.removeEntity?.(st.id); } catch {}
            });
          } catch {}
        };
        strongRemoveAll();
        setTimeout(strongRemoveAll, 150);
        setTimeout(strongRemoveAll, 500);
        setTimeout(strongRemoveAll, 1200);
        // Apply studies (indicators) after chart is ready to ensure inputs are respected
        try {
          const studiesIn = Array.isArray(presetNorm?.studies) ? (presetNorm.studies as any[]) : [];
          const volOverlay = !!(presetNorm as any)?.volumeOverlay;
          const shouldHaveVolume = studiesIn.some((s: any) => {
            const id = typeof s === "string" ? String(s) : String(s?.type || "");
            return id.startsWith("Volume@");
          });
          studiesIn.forEach((s: any) => {
            const id = typeof s === "string" ? String(s) : String(s?.type || "");
            if (!id) return;
            const inputs = typeof s === "string" ? undefined : (Array.isArray(s?.inputs) ? s.inputs : undefined);
            const overlay = id.startsWith("Volume@") ? volOverlay : false;
            try { chartApi?.createStudy?.(id, overlay, false, inputs); } catch {}
          });
          if (!shouldHaveVolume) {
            const removeIfVolumeAppears = () => {
              try {
                const list = (chartApi as any)?.getAllStudies?.() || [];
                list.forEach((st: any) => {
                  const name = String(st?.name || st?.fullName || st?.type || "").toLowerCase();
                  if (name.includes("volume")) {
                    try { (chartApi as any)?.removeStudy?.(st.id); } catch {}
                    try { (chartApi as any)?.removeEntity?.(st.id); } catch {}
                  }
                });
              } catch {}
            };
            setTimeout(removeIfVolumeAppears, 200);
            setTimeout(removeIfVolumeAppears, 800);
            setTimeout(removeIfVolumeAppears, 1600);
          }
          if (presetNorm?.studies_overrides) {
            try {
              if (typeof (tv as any).applyStudiesOverrides === "function") {
                (tv as any).applyStudiesOverrides(presetNorm.studies_overrides);
              } else if (chartApi && typeof (chartApi as any).applyStudiesOverrides === "function") {
                (chartApi as any).applyStudiesOverrides(presetNorm.studies_overrides);
              }
            } catch {}
          }
        } catch {}
      } catch {}
    });
  }).catch(() => {
    // fail silently for preview
  });
}
