import { useEffect, useMemo, useRef, useState } from "react";
import { type TVPreset } from "../lib/preset64";

 

// Friendly timeframe mapping shown to the user, mapped to TradingView intervals (localized)
const TF_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "۱ دقیقه", value: "1" },
  { label: "۳ دقیقه", value: "3" },
  { label: "۵ دقیقه", value: "5" },
  { label: "۱۵ دقیقه", value: "15" },
  { label: "۳۰ دقیقه", value: "30" },
  { label: "۱ ساعت", value: "60" },
  { label: "۲ ساعت", value: "120" },
  { label: "۴ ساعت", value: "240" },
  { label: "روزانه", value: "D" },
  { label: "هفتگی", value: "W" },
  { label: "ماهانه", value: "M" },
];

// Curated timezone list for quick selection
const TIMEZONE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Etc/UTC", value: "Etc/UTC" },
  { label: "Europe/London", value: "Europe/London" },
  { label: "Europe/Berlin", value: "Europe/Berlin" },
  { label: "Europe/Istanbul", value: "Europe/Istanbul" },
  { label: "Asia/Tehran", value: "Asia/Tehran" },
  { label: "Asia/Dubai", value: "Asia/Dubai" },
  { label: "Asia/Kolkata", value: "Asia/Kolkata" },
  { label: "Asia/Shanghai", value: "Asia/Shanghai" },
  { label: "Asia/Tokyo", value: "Asia/Tokyo" },
  { label: "America/New_York", value: "America/New_York" },
  { label: "America/Chicago", value: "America/Chicago" },
  { label: "America/Los_Angeles", value: "America/Los_Angeles" },
  { label: "America/Sao_Paulo", value: "America/Sao_Paulo" },
  { label: "Australia/Sydney", value: "Australia/Sydney" },
];

export default function PresetBuilder({ initial, onChange }: { initial?: TVPreset; onChange?: (p: TVPreset) => void }) {
  // Basics (no symbol field here)
  const [theme, setTheme] = useState<"" | "light" | "dark">("");
  const [chartInterval, setChartInterval] = useState<string>("D");
  const [timezone, setTimezone] = useState<string>("Etc/UTC");

  // Visibility / behavior
  const [hideSideToolbar, setHideSideToolbar] = useState<boolean>(true);
  const [hideTopToolbar, setHideTopToolbar] = useState<boolean>(false);
  const [allowSymbolChange, setAllowSymbolChange] = useState<boolean>(true);
  const [withDateRanges, setWithDateRanges] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showWatermark, setShowWatermark] = useState<boolean>(true);

  // Background
  const [bgType, setBgType] = useState<"solid" | "gradient">("solid");
  const [bgSolid, setBgSolid] = useState<string>("#0b0f14");
  const [bgGradStart, setBgGradStart] = useState<string>("#0b0f14");
  const [bgGradEnd, setBgGradEnd] = useState<string>("#10151d");

  // Grid
  const [gridVert, setGridVert] = useState<string>("#263241");
  const [gridHorz, setGridHorz] = useState<string>("#263241");

  // Candle colors
  const [candleUpColor, setCandleUpColor] = useState<string>("#089981");
  const [candleDownColor, setCandleDownColor] = useState<string>("#F23645");
  const [wickUpColor, setWickUpColor] = useState<string>("#089981");
  const [wickDownColor, setWickDownColor] = useState<string>("#F23645");
  const [borderUpColor, setBorderUpColor] = useState<string>("#089981");
  const [borderDownColor, setBorderDownColor] = useState<string>("#F23645");

  // Indicators
  const [rsiEnabled, setRsiEnabled] = useState<boolean>(false);
  const [rsiLength, setRsiLength] = useState<number>(14);
  const [macdEnabled, setMacdEnabled] = useState<boolean>(false);
  const [macdFast, setMacdFast] = useState<number>(12);
  const [macdSlow, setMacdSlow] = useState<number>(26);
  const [macdSignal, setMacdSignal] = useState<number>(9);
  const [volumeEnabled, setVolumeEnabled] = useState<boolean>(false);
  const [volumeOverlay, setVolumeOverlay] = useState<boolean>(false);

  const preset = useMemo(() => {
    const overrides: Record<string, any> = {};

    // Background overrides
    if (bgType === "solid") {
      overrides["paneProperties.backgroundType"] = "solid";
      overrides["paneProperties.background"] = bgSolid;
      overrides["paneProperties.backgroundGradientStartColor"] = bgSolid;
      overrides["paneProperties.backgroundGradientEndColor"] = bgSolid;
    } else {
      overrides["paneProperties.backgroundType"] = "gradient";
      overrides["paneProperties.backgroundGradientStartColor"] = bgGradStart;
      overrides["paneProperties.backgroundGradientEndColor"] = bgGradEnd;
      overrides["paneProperties.background"] = bgGradStart;
    }

    // Grid overrides
    if (gridVert) overrides["paneProperties.vertGridProperties.color"] = gridVert;
    if (gridHorz) overrides["paneProperties.horzGridProperties.color"] = gridHorz;

    // Studies
    const studies: any[] = [];
    if (rsiEnabled)
      studies.push({ type: "RSI@tv-basicstudies", inputs: [Number(rsiLength) || 14] });
    if (macdEnabled)
      studies.push({ type: "MACD@tv-basicstudies", inputs: [Number(macdFast) || 12, Number(macdSlow) || 26, Number(macdSignal) || 9] });
    if (volumeEnabled) studies.push("Volume@tv-basicstudies");

    // Build preset object (no symbol)
    const p: TVPreset = {
      ...(theme ? { theme } : {}),
      style: 1,
      ...(chartInterval ? { interval: chartInterval } : {}),
      ...(timezone ? { timezone } : {}),
      hide_side_toolbar: hideSideToolbar,
      hide_top_toolbar: hideTopToolbar,
      allow_symbol_change: allowSymbolChange,
      withdateranges: withDateRanges,
      showLegend,
      showWatermark,
      volumeOverlay,

      // top-level helpers (our loader also maps these to overrides)
      backgroundColor: bgType === "solid" ? bgSolid : undefined,
      gridColor: gridVert === gridHorz ? gridVert : undefined,

      // candle colors
      candleUpColor,
      candleDownColor,
      wickColor: wickUpColor,
      wickColorDown: wickDownColor,
      borderUpColor,
      borderDownColor,

      // raw overrides pass-through
      overrides,

      // indicators
      studies,
    };

    return p;
  }, [
    theme,
    chartInterval,
    timezone,
    hideSideToolbar,
    hideTopToolbar,
    allowSymbolChange,
    withDateRanges,
    showLegend,
    showWatermark,
    bgType,
    bgSolid,
    bgGradStart,
    bgGradEnd,
    gridVert,
    gridHorz,
    candleUpColor,
    candleDownColor,
    wickUpColor,
    wickDownColor,
    borderUpColor,
    borderDownColor,
    rsiEnabled,
    rsiLength,
    macdEnabled,
    macdFast,
    macdSlow,
    macdSignal,
    volumeEnabled,
    volumeOverlay,
  ]);

  // Hydrate from initial preset when provided. Use a content signature to avoid re-hydrating repeatedly.
  const hydratedSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initial) return;
    let sig = "";
    try { sig = JSON.stringify(initial); } catch {}
    if (hydratedSigRef.current === sig) return;
    hydratedSigRef.current = sig;

    try {
      if (initial.theme === "light" || initial.theme === "dark") setTheme(initial.theme);
      if (typeof initial.interval === "string") setChartInterval(initial.interval);
      if (typeof initial.timezone === "string") setTimezone(initial.timezone);

      if (typeof initial.hide_side_toolbar === "boolean") setHideSideToolbar(initial.hide_side_toolbar);
      if (typeof initial.hide_top_toolbar === "boolean") setHideTopToolbar(initial.hide_top_toolbar);
      if (typeof initial.allow_symbol_change === "boolean") setAllowSymbolChange(initial.allow_symbol_change);
      if (typeof initial.withdateranges === "boolean") setWithDateRanges(initial.withdateranges);
      if (typeof initial.showLegend === "boolean") setShowLegend(initial.showLegend);
      if (typeof initial.showWatermark === "boolean") setShowWatermark(initial.showWatermark);
      // Overlay-on-price for Volume is not supported in UI anymore; force false for consistency
      setVolumeOverlay(false);

      // Background
      const bgTypeOverride = initial.overrides?.["paneProperties.backgroundType"] as string | undefined;
      if (bgTypeOverride === "gradient") {
        setBgType("gradient");
        const start = initial.overrides?.["paneProperties.backgroundGradientStartColor"] as string | undefined;
        const end = initial.overrides?.["paneProperties.backgroundGradientEndColor"] as string | undefined;
        if (typeof start === "string") setBgGradStart(start);
        if (typeof end === "string") setBgGradEnd(end);
      } else if (typeof initial.backgroundColor === "string") {
        setBgType("solid");
        setBgSolid(initial.backgroundColor);
      }

      // Grid
      if (typeof initial.gridColor === "string") {
        setGridVert(initial.gridColor);
        setGridHorz(initial.gridColor);
      } else {
        const gv = initial.overrides?.["paneProperties.vertGridProperties.color"] as string | undefined;
        const gh = initial.overrides?.["paneProperties.horzGridProperties.color"] as string | undefined;
        if (typeof gv === "string") setGridVert(gv);
        if (typeof gh === "string") setGridHorz(gh);
      }

      // Candle colors
      if (typeof initial.candleUpColor === "string") setCandleUpColor(initial.candleUpColor);
      if (typeof initial.candleDownColor === "string") setCandleDownColor(initial.candleDownColor);
      if (typeof initial.wickColor === "string") setWickUpColor(initial.wickColor);
      if (typeof initial.wickColorDown === "string") setWickDownColor(initial.wickColorDown);
      if (typeof initial.borderUpColor === "string") setBorderUpColor(initial.borderUpColor);
      if (typeof initial.borderDownColor === "string") setBorderDownColor(initial.borderDownColor);

      // Indicators from studies array
      const studies = Array.isArray(initial.studies) ? initial.studies : [];
      const hasRSI = studies.some((s: any) => (typeof s === "object" ? String(s?.type) : String(s)).startsWith("RSI@tv-basicstudies"));
      const hasMACD = studies.some((s: any) => (typeof s === "object" ? String(s?.type) : String(s)).startsWith("MACD@tv-basicstudies"));
      const hasVolume = studies.some((s: any) => (typeof s === "object" ? String(s?.type) : String(s)).startsWith("Volume@tv-basicstudies"));
      setRsiEnabled(hasRSI);
      setMacdEnabled(hasMACD);
      setVolumeEnabled(hasVolume);
    } catch {}
    // run only when initial content actually changes
  }, [initial]);

  // Emit changes upward
  useEffect(() => {
    onChange?.(preset);
  }, [preset, onChange]);
  
  const TABS = [
    { key: "basic", label: "پایه" },
    { key: "appearance", label: "ظاهر" },
    { key: "indicators", label: "اندیکاتورها" },
  ] as const;
  type TabKey = (typeof TABS)[number]["key"];
  const [activeTab, setActiveTab] = useState<TabKey>("basic");

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      {/* <h1 className="text-2xl font-semibold">سازنده پریست</h1> */}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-zinc-700 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${
              activeTab === t.key
                ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 shadow-sm"
                : "bg-transparent text-zinc-600 dark:text-zinc-300"
            } px-3 py-1.5 rounded-t`}
            onClick={() => setActiveTab(t.key as TabKey)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "basic" && (
        <div className="space-y-6">
          {/* Basics (no symbol) */}
          <section className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm">قالب (اختیاری)</label>
              <select
                className="select-base"
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
              >
                <option value="">پیش‌فرض</option>
                <option value="light">روشن</option>
                <option value="dark">تیره</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm">بازه زمانی</label>
              <select
                className="select-base"
                value={chartInterval}
                onChange={(e) => setChartInterval(e.target.value)}
              >
                {TF_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm">منطقه زمانی</label>
              <select
                className="select-base"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Visibility */}
          <section className="grid md:grid-cols-3 gap-4">
            <label className="inline-flex items-center gap-2">
              <input
                checked={hideSideToolbar}
                type="checkbox"
                onChange={(e) => setHideSideToolbar(e.target.checked)}
              />
              <span>پنهان کردن نوار ابزار کناری</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                checked={hideTopToolbar}
                type="checkbox"
                onChange={(e) => setHideTopToolbar(e.target.checked)}
              />
              <span>پنهان کردن نوار ابزار بالا</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                checked={allowSymbolChange}
                type="checkbox"
                onChange={(e) => setAllowSymbolChange(e.target.checked)}
              />
              <span>اجازه تغییر نماد</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                checked={withDateRanges}
                type="checkbox"
                onChange={(e) => setWithDateRanges(e.target.checked)}
              />
              <span>با محدوده‌های تاریخ</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                checked={showLegend}
                type="checkbox"
                onChange={(e) => setShowLegend(e.target.checked)}
              />
              <span>نمایش راهنما</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                checked={showWatermark}
                type="checkbox"
                onChange={(e) => setShowWatermark(e.target.checked)}
              />
              <span>نمایش واترمارک</span>
            </label>
          </section>
        </div>
      )}

      {activeTab === "appearance" && (
        <div className="space-y-6">
          {/* Background */}
          <section className="space-y-3">
            <h2 className="font-medium">پس‌زمینه</h2>
            <div className="flex gap-4 items-center">
              <label className="inline-flex items-center gap-2">
                <input
                  checked={bgType === "solid"}
                  name="bgType"
                  type="radio"
                  value="solid"
                  onChange={() => setBgType("solid")}
                />
                <span>تک‌رنگ</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  checked={bgType === "gradient"}
                  name="bgType"
                  type="radio"
                  value="gradient"
                  onChange={() => setBgType("gradient")}
                />
                <span>گرادیان</span>
              </label>
            </div>
            {bgType === "solid" ? (
              <div className="flex items-center gap-3">
                <label className="text-sm">رنگ</label>
                <input type="color" value={bgSolid} onChange={(e) => setBgSolid(e.target.value)} />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm">شروع</label>
                  <input type="color" value={bgGradStart} onChange={(e) => setBgGradStart(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">پایان</label>
                  <input type="color" value={bgGradEnd} onChange={(e) => setBgGradEnd(e.target.value)} />
                </div>
              </div>
            )}
          </section>

          {/* Grid */}
          <section className="space-y-3">
            <h2 className="font-medium">شبکه</h2>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <label className="text-sm">عمودی</label>
                <input type="color" value={gridVert} onChange={(e) => setGridVert(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">افقی</label>
                <input type="color" value={gridHorz} onChange={(e) => setGridHorz(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Candle colors */}
          <section className="space-y-3">
            <h2 className="font-medium">رنگ‌های کندل</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm">بدنه صعودی</label>
                <input type="color" value={candleUpColor} onChange={(e) => setCandleUpColor(e.target.value)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm">بدنه نزولی</label>
                <input type="color" value={candleDownColor} onChange={(e) => setCandleDownColor(e.target.value)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm">فتیله صعودی</label>
                <input type="color" value={wickUpColor} onChange={(e) => setWickUpColor(e.target.value)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm">فتیله نزولی</label>
                <input type="color" value={wickDownColor} onChange={(e) => setWickDownColor(e.target.value)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm">حاشیه صعودی</label>
                <input type="color" value={borderUpColor} onChange={(e) => setBorderUpColor(e.target.value)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm">حاشیه نزولی</label>
                <input type="color" value={borderDownColor} onChange={(e) => setBorderDownColor(e.target.value)} />
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "indicators" && (
        <div className="space-y-6">
          {/* Indicators */}
          <section className="space-y-3">
            <h2 className="font-medium">اندیکاتورها</h2>
            <div className="grid md:grid-cols-3 gap-4 items-start">
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2">
                  <input checked={rsiEnabled} type="checkbox" onChange={(e) => setRsiEnabled(e.target.checked)} />
                  <span>RSI</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">طول</span>
                  <input
                    className="w-24 px-2 py-1 rounded border border-gray-300 dark:border-zinc-700 bg-transparent"
                    disabled={!rsiEnabled}
                    min={1}
                    type="number"
                    value={rsiLength}
                    onChange={(e) => setRsiLength(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2">
                  <input checked={macdEnabled} type="checkbox" onChange={(e) => setMacdEnabled(e.target.checked)} />
                  <span>MACD</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    سریع
                    <input
                      className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-zinc-700 bg-transparent"
                      disabled={!macdEnabled}
                      min={1}
                      type="number"
                      value={macdFast}
                      onChange={(e) => setMacdFast(Number(e.target.value))}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    کند
                    <input
                      className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-zinc-700 bg-transparent"
                      disabled={!macdEnabled}
                      min={1}
                      type="number"
                      value={macdSlow}
                      onChange={(e) => setMacdSlow(Number(e.target.value))}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    سیگنال
                    <input
                      className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-zinc-700 bg-transparent"
                      disabled={!macdEnabled}
                      min={1}
                      type="number"
                      value={macdSignal}
                      onChange={(e) => setMacdSignal(Number(e.target.value))}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm">حجم</div>
                <div className="flex flex-col gap-1">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="volumeMode"
                      checked={!volumeEnabled}
                      onChange={() => { setVolumeEnabled(false); setVolumeOverlay(false); }}
                    />
                    <span>بدون حجم</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="volumeMode"
                      checked={volumeEnabled && !volumeOverlay}
                      onChange={() => { setVolumeEnabled(true); setVolumeOverlay(false); }}
                    />
                    <span>پنل جداگانه</span>
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
