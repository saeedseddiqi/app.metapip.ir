# MetaPip – Next.js 15 + Tauri 2

این پروژه به طور کامل از React (Vite/CRA) به Next.js (App Router) مهاجرت کرده و با Tauri 2 یکپارچه شده است.

## ساختار کلیدی

- `app/`: مسیردهی Next.js (App Router)
- `app/layout.tsx`: چارچوب صفحه‌ها و منوی ناوبری (RTL + فونت Vazirmatn)
- `app/{dashboard,settings,presets,events}/page.tsx`: صفحات اصلی (Client Components)
- `app/globals.css`: Tailwind v4 (@import "tailwindcss")
- `next.config.ts`: خروجی استاتیک (`output: 'export'`) برای بسته‌بندی در Tauri
- `postcss.config.js`: شامل `tailwindcss` و `autoprefixer`
- `tailwind.config.js`: مسیرهای `app/**/*` و `src/**/*`
- `public/`: آیکن‌ها و دارایی‌های استاتیک (google.svg, notion.svg, tauri.svg)
- `src/`: کدهای موجود (AuthPanel, Settings, Dashboard, Logs, preset64, tvLoader)

> توجه: آثار Vite مثل `index.html`, `vite.config.ts`, `src/main.tsx` دیگر استفاده نمی‌شوند و از TS خارج شده‌اند (tsconfig.exclude). می‌توانید پس از اطمینان حذفشان کنید.

## تنظیم محیط (ENV)

متغیرها به الگوی Next تغییر کرده‌اند:

```
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

اگر از قبل `.env` با کلیدهای `VITE_...` دارید، آن‌ها را به `NEXT_PUBLIC_...` تغییر دهید.

### اجرای بک‌اند: dev (Python) / prod (EXE)

برای انتخاب نحوه اجرای منطق متاسنتر (بک‌اند) از متغیرهای زیر در `.env` استفاده کنید:

```
# dev: اجرای اسکریپت پایتون (رفتار فعلی)
# prod: اجرای فایل اجرایی EXE به‌صورت پس‌زمینه
BACKEND_MODE=dev

# مسیر فایل EXE در حالت prod (نمونه در ویندوز)
BACKEND_EXE_PATH=C:\\path\\to\\MetaCenter.exe

# (اختیاری) مسیر کاری EXE؛ اگر خالی باشد از پوشه والد EXE استفاده می‌شود
BACKEND_WORKING_DIR=C:\\path\\to

# (اختیاری) آرگومان‌های EXE به‌صورت space-separated
BACKEND_EXE_ARGS=--port 8765 --verbose
```

نکات:

- در ویندوز نیازی به نقل‌قول برای مسیر دارای فاصله نیست؛ از مقدار کامل `C:\\some path\\MetaCenter.exe` استفاده کنید.
- پنجره کنسول EXE مخفی اجرا می‌شود (CREATE_NO_WINDOW) و خروجی stdout/stderr به پنل «Events/گزارش رویدادها» ارسال می‌شود.
- منو/تری آیکن در Tauri با برچسب «Start Backend/Stop Backend» بروزرسانی شده است.
- اگر خطای 193 مشاهده کردید (invalide exe)، مسیر EXE و معماری 64-بیتی بودن فایل را بررسی کنید.

## اجرای حالت Web (Standalone)

1. وابستگی‌ها: `npm install`
2. اجرا: `npm run dev` (پورت 1421)
3. باز کردن: http://localhost:1421

بیلد و پیش‌نمایش استاتیک:

```
npm run build   # next build && next export -> out/
npm run preview # سرو فایل‌های out/ روی پورت 1421
```

## اجرای حالت Desktop (Tauri)

پیش‌نیازها: Rust toolchain, Tauri prerequisites

- Dev: `npm run tauri dev` (Next dev روی 1421 و بارگذاری در Tauri)
- Build: `npm run build` سپس `npm run tauri build` (Tauri از `out/` بارگذاری می‌کند)

## نکات سازگاری

- کامپوننت‌هایی که به Tauri API نیاز دارند به‌صورت داینامیک با `ssr: false` لود می‌شوند تا SSR/Export دچار مشکل نشود.
- در محیط Web، فراخوانی‌های Tauri داخل `try/catch` هستند و به `window.open`/no-op سقوط می‌کنند.
- Tailwind v4 از طریق `@import "tailwindcss"` در `app/globals.css` فعال است.

## مسیرها

- `/dashboard`، `/settings`، `/presets`، `/events` (جایگزین «Logs»)

## اسکریپت‌ها

- `dev`: اجرای Next dev روی 1421
- `build`: `next build && next export` (خروجی در `out/`)
- `preview`: سرو کردن `out/`
- `tauri`: ابزار CLI تاوری

