# MetaPip – Next.js 15 + Tauri 2

این پروژه به طور کامل به Next.js (Pages Router) مهاجرت کرده و با Tauri 2 یکپارچه شده است. خروجی وب به صورت Static Export (SPA) تولید می‌شود تا با میزبانی استاتیک/ورسل سازگار باشد.

## ساختار کلیدی

- `pages/`: مسیردهی Next.js (Pages Router)
- `pages/_app.tsx`: راه‌انداز UI/Providers (Theme/Clerk/Supabase)
- `pages/_document.tsx`: تنظیمات HTML پایه (RTL/FA)
- `pages/{index,dashboard,settings,chart-templates,events,positions,risk,setups,devices,diagnostics}.tsx`
- `pages/{presets,screenshot-presets}.tsx`: ریدایرکت به `/chart-templates`
- `pages/oauth-bridge.tsx`: پل بازگشت OAuth → Deep Link دسکتاپ
- `src/pages-compat/{Providers,HeaderShell,ThemeToggle}.tsx`: نسخه‌های سازگار با Pages Router
- `src/styles/globals.css`: Tailwind v4 (@import "tailwindcss")
- `next.config.ts`: خروجی استاتیک (`output: 'export'`) برای بسته‌بندی در Tauri
- `postcss.config.js`: شامل `tailwindcss` و `autoprefixer`
- `tailwind.config.js`: مسیرهای `pages/**/*` و `src/**/*`
- `public/`: آیکن‌ها و دارایی‌های استاتیک (google.svg, notion.svg, tauri.svg)
- `src/`: کدهای موجود (AuthPanel, Settings, Dashboard, Logs, preset64, tvLoader)

> توجه: پوشه‌های قدیمی App Router (مانند `app/` یا `src/app/`) حذف یا غیرفعال شده‌اند تا با Pages Router تداخلی نداشته باشند.

## تنظیم محیط (ENV)

متغیرها به الگوی Next تغییر کرده‌اند:

```
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_ ...
# یکی از گزینه‌های زیر برای مبنای OAuth/OIDC
NEXT_PUBLIC_CLERK_BASE_URL=https://accounts.metapip.ir
# یا
# NEXT_PUBLIC_CLERK_OAUTH_BASE= ...
# NEXT_PUBLIC_CLERK_HOSTED_URL=...

# یکی از گزینه‌های Client ID
NEXT_PUBLIC_CLERK_CLIENT_ID= ...
# یا
# NEXT_PUBLIC_CLERK_OAUTH_CLIENT_ID=...

# اختیاری
NEXT_PUBLIC_SUPABASE_SESSION_ENABLED=1
NEXT_PUBLIC_DESKTOP_DISABLE_CLERK=0
```

اگر از قبل `.env` با کلیدهای `VITE_...` دارید، آن‌ها را به `NEXT_PUBLIC_...` تغییر دهید.

### اجرای بک‌اند: dev (Python) / prod (EXE)

{{ ... }}
3. باز کردن: http://localhost:1421

بیلد و پیش‌نمایش استاتیک:

```
npm run build   # next build && next export -> .out/
npm run preview # سرو فایل‌های .out/ روی پورت 1421
```

## اجرای حالت Desktop (Tauri)

پیش‌نیازها: Rust toolchain, Tauri prerequisites

- Dev: `npm run tauri dev` (Next dev روی 1421 و بارگذاری در Tauri)
- Build: `npm run build` سپس `npm run tauri build` (Tauri از `.out/` بارگذاری می‌کند)

## نکات سازگاری

- کامپوننت‌هایی که به Tauri API نیاز دارند به‌صورت داینامیک با `ssr: false` لود می‌شوند تا SSR/Export دچار مشکل نشود.
- در محیط Web، فراخوانی‌های Tauri داخل `try/catch` هستند و به `window.open`/no-op سقوط می‌کنند.
- Tailwind v4 از طریق `@import "tailwindcss"` در `src/styles/globals.css` فعال است.

## مسیرها

- `/`، `/dashboard`، `/settings`، `/chart-templates`، `/events`، `/positions`، `/risk`، `/setups`، `/devices`، `/diagnostics`
- ریدایرکت‌ها: `/presets` → `/chart-templates` ، `/screenshot-presets` → `/chart-templates`
- پل OAuth: `/oauth-bridge` (برای Deep Link دسکتاپ)

## اسکریپت‌ها

- `dev`: اجرای Next dev روی 1421
- `build`: `next build && next export` (خروجی در `.out/`)
- `preview`: سرو کردن `.out/`
- `tauri`: ابزار CLI تاوری
