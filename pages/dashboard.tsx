import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { SignedIn, SignedOut, SignIn, useAuth } from '@clerk/nextjs';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useClerkSupabaseSession } from '@/lib/auth/useClerkSupabaseSession';
import { openHostedSignIn, openOAuthUrl } from '@/lib/auth/deepLink';
import { subscribe as diagSubscribe, getAll as diagGetAll, clear as diagClear, DiagLog } from '@/lib/diagnostics/logger';

const Dashboard = dynamic(() => import('@/components/Dashboard').then(m => m.Dashboard), { ssr: false });

async function tauriInvoke<T = any>(cmd: string, args?: any): Promise<T> {
  const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
  if (!isTauri) throw new Error('Not running in Tauri environment');
  try {
    const rtImport = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
    const core = await rtImport('@tauri-apps/api/core').catch(() => null as any);
    if (core && typeof core.invoke === 'function') return core.invoke(cmd, args);
  } catch {}
  const fallback = (window as any).__TAURI__?.core?.invoke;
  if (typeof fallback === 'function') return fallback(cmd, args);
  throw new Error('Tauri invoke is not available');
}

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  if (typeof window === 'undefined') return Buffer.from(s, 'base64').toString();
  try { return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))); } catch { return ''; }
}

function decodeJwt(token: string): { header: any; payload: any } | null {
  try {
    const [h, p] = token.split('.');
    const header = JSON.parse(b64urlDecode(h));
    const payload = JSON.parse(b64urlDecode(p));
    return { header, payload };
  } catch { return null; }
}

function fmtExp(exp?: number): string {
  if (!exp) return 'n/a';
  const secs = Math.round(exp - Date.now() / 1000);
  return `${secs}s ${secs < 0 ? 'expired' : 'left'}`;
}

export default function DashboardPage() {
  const desktopMode = (() => {
    const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || '0').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  })();

  // Ensure client-side Supabase session when enabled (web only)
  if (!desktopMode) {
    try { useClerkSupabaseSession(); } catch {}
  }

  // Common states
  const [logs, setLogs] = React.useState<string[]>([]);
  const [diagLogs, setDiagLogs] = React.useState<DiagLog[]>(() => diagGetAll());
  const [testing, setTesting] = React.useState(false);
  const sessionEnabled = (() => {
    const v = String(process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED || '0').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  })();
  const [isTauri, setIsTauri] = React.useState(false);
  const [envStatus, setEnvStatus] = React.useState<any>(null);
  const [_verifyStatus, setVerifyStatus] = React.useState<'idle'|'ok'|'fail'|'na'>('idle');
  const [showWelcome, setShowWelcome] = React.useState(false);
  const router = useRouter();
  const autoRanRef = React.useRef(false);

  const { getToken, isSignedIn } = useAuth();

  const log = React.useCallback((m: string) => setLogs((x) => [m, ...x].slice(0, 200)), []);

  const run = React.useCallback(async () => {
    setTesting(true);
    setLogs([]);
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase client not configured (.env)');
      let token: string | null = null;
      if (desktopMode) {
        try {
          const tok = await tauriInvoke<string>('load_secure_token', { accountId: null } as any);
          token = tok && typeof tok === 'string' && !tok.startsWith('ERR:') ? tok : null;
        } catch {}
      } else {
        token = await getToken?.({ template: 'supabase' } as any) as any;
        if (!token) token = await (getToken?.({ template: 'session' } as any) as Promise<string | null>);
      }
      if (!token) throw new Error('No JWT available');
      const dec = decodeJwt(token);
      if (dec) {
        const aud = Array.isArray(dec.payload?.aud) ? dec.payload.aud.join(',') : (dec.payload?.aud ?? 'n/a');
        log(`JWT info: alg=${dec.header?.alg ?? '?'}, kid=${dec.header?.kid ?? '?'}, iss=${dec.payload?.iss ?? '?'}, aud=${aud}, exp=${fmtExp(dec.payload?.exp)}`);
      }
      log('✅ Clerk token acquired');
      if (sessionEnabled) {
        const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionRes.session) throw sessionErr || new Error('No Supabase session');
        log('✅ Supabase client session active');
        const { data: rows, error } = await supabase.from('devices').select('*').limit(5);
        if (error) throw error;
        log(`✅ RLS devices select ok (${rows?.length ?? 0} rows)`);
      } else {
        log('ℹ️ Client-side Supabase session is disabled by config. Skipping session/RLS test.');
      }
      log('🎉 All tests passed');
    } catch (e: any) {
      log(`❌ ${e?.message || String(e)}`);
    } finally {
      setTesting(false);
    }
  }, [desktopMode, log, sessionEnabled, getToken]);

  const runTauriVerify = React.useCallback(async () => {
    setTesting(true);
    try {
      const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
      if (!isTauri) throw new Error('Not running in Tauri environment');

      // 1. ابتدا مطمئن شویم سوپابیس کانفیگ شده است
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not properly configured');
      }

      // 2. بررسی وضعیت احراز هویت کلرک
      if (!isSignedIn) {
        throw new Error('User is not signed in to Clerk');
      }

      // 3. انتظار برای آماده شدن توکن (تا ۵ ثانیه)
      let token = null;
      let attempts = 0;
      while (!token && attempts < 10) { // حداکثر ۱۰ تلاش (۵ ثانیه)
        try {
          token = await getToken?.({ template: 'supabase' });
          if (!token) {
            await new Promise(resolve => setTimeout(resolve, 500)); // انتظار ۵۰۰ میلی‌ثانیه
            attempts++;
          }
        } catch (e) {
          console.warn('Token retrieval attempt failed:', e);
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
      }

      if (!token) {
        throw new Error('Failed to retrieve Clerk token after multiple attempts');
      }

      // 4. تنظیم نشست سوپابیس با توکن کلرک
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'clerk',
        token: token
      });

      if (signInError) {
        // اگر clerk هم کار نکرد، از setSession استفاده کنیم
        console.log('Trying setSession approach...');
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: token
        } as any);

        if (setSessionError) {
          throw setSessionError;
        }
      }

      // 5. بررسی نهایی نشست
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionRes.session) {
        throw sessionErr || new Error('Failed to establish Supabase session');
      }

      log('✅ Supabase session established successfully in Tauri');
    } catch (e: any) {
      log(`❌ Tauri session check failed: ${e?.message || String(e)}`);
    } finally {
      setTesting(false);
    }
  }, [desktopMode, log, getToken, isSignedIn]);

  // Utilities for deep-link debugging (desktop mode)
  const buildHostedUrl = React.useCallback(() => {
    const base = (process.env.NEXT_PUBLIC_CLERK_HOSTED_URL as string | undefined)
      || (process.env.NEXT_PUBLIC_CLERK_BASE_URL as string | undefined)
      || (process.env.NEXT_PUBLIC_CLERK_OAUTH_BASE as string | undefined)
      || 'https://accounts.metapip.ir';
    const url = new URL(`${base.replace(/\/$/, '')}/sign-in`);
    const redirect = 'metapip://auth/callback';
    url.searchParams.set('redirect_url', redirect);
    url.searchParams.set('after_sign_in_url', redirect);
    url.searchParams.set('after_sign_up_url', redirect);
    url.searchParams.set('after_switch_session_url', redirect);
    return url.toString();
  }, []);

  const registerDeepLink = React.useCallback(async () => {
    try {
      const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
      if (!isTauri) throw new Error('Not running in Tauri environment');
      const deep = await import('@tauri-apps/plugin-deep-link').catch(() => null as any);
      if (!deep || typeof (deep as any).register !== 'function') throw new Error('plugin-deep-link not available');
      await (deep as any).register('metapip');
      log("✅ DeepLink: scheme 'metapip' registered (dev)");
      try { console.log('[DeepLink] runtime scheme registered: metapip'); } catch {}
    } catch (e: any) {
      log(`❌ DeepLink register failed: ${e?.message || String(e)}`);
      try { console.warn('[DeepLink] register failed', e); } catch {}
    }
  }, [log]);

  const openTestDeepLink = React.useCallback(async () => {
    const testUrl = 'metapip://auth/callback?test=1';
    try {
      const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
      if (!isTauri) throw new Error('Not running in Tauri environment');
      await openOAuthUrl(testUrl);
      log('↗️ Opened test deep link via Shell/Invoke');
      return;
    } catch (e: any) {
      log(`⚠️ opener failed (${e?.message || String(e)}); trying window.open`);
      try {
        const w = window.open(testUrl, '_blank');
        if (!w) window.location.href = testUrl;
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'message' in (err as any) ? (err as any).message : String(err);
        log(`❌ window.open failed: ${msg}`);
      }
    }
  }, [log]);

  const copyHostedLink = React.useCallback(async () => {
    try {
      const url = buildHostedUrl();
      await navigator.clipboard.writeText(url);
      log('📋 Hosted sign-in URL copied to clipboard');
      try { console.log('[DeepLink] hosted url:', url); } catch {}
    } catch (e: any) {
      log(`❌ Copy failed: ${e?.message || String(e)}`);
    }
  }, [buildHostedUrl, log]);

  React.useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__));
  }, []);

  // Subscribe to diagnostics logger
  React.useEffect(() => {
    const unsub = diagSubscribe((l) => setDiagLogs(l));
    return () => { try { unsub && unsub(); } catch {} };
  }, []);

  // Auto-run session presence test once
  React.useEffect(() => {
    if (autoRanRef.current) return;
    if (!isSupabaseConfigured || !sessionEnabled) return;
    autoRanRef.current = true;
    const t = setTimeout(() => { void run(); }, 100);
    return () => clearTimeout(t);
  }, [sessionEnabled, run]);

  // Detect signup success flag from query and show welcome/test banner; then clean URL.
  React.useEffect(() => {
    try {
      const ok = (router.query?.signup as string | undefined) === 'success';
      if (ok) {
        setShowWelcome(true);
        if (typeof window !== 'undefined') {
          const u = new URL(window.location.href);
          u.searchParams.delete('signup');
          router.replace(u.pathname + (u.search ? u.search : '') + (u.hash ? u.hash : ''));
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query?.signup]);

  const runChecklist = React.useCallback(async () => {
    try {
      const tauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
      setIsTauri(tauri);
      if (!tauri) {
        setEnvStatus(null);
        setVerifyStatus('na');
        log('ℹ️ Not running in Tauri; env checklist is not applicable');
        return;
      }
      if (!desktopMode) {
        setVerifyStatus('na');
        log('ℹ️ Checklist verify is only applicable in desktop mode');
        return;
      }
      const { invoke } = await import('@tauri-apps/api/core');
      const envJson = await invoke<string>('tauri_env_status');
      try { setEnvStatus(JSON.parse(envJson)); } catch { setEnvStatus(null); }
      const tok = await invoke<string>('load_secure_token', { accountId: null } as any);
      const token = tok && typeof tok === 'string' && !tok.startsWith('ERR:') ? tok : null;
      if (!token) throw new Error('No JWT available');
      const dec = decodeJwt(token);
      if (dec) {
        const aud = Array.isArray(dec.payload?.aud) ? dec.payload.aud.join(',') : (dec.payload?.aud ?? 'n/a');
        log(`JWT info: alg=${dec.header?.alg ?? '?'}, kid=${dec.header?.kid ?? '?'}, iss=${dec.payload?.iss ?? '?'}, aud=${aud}, exp=${fmtExp(dec.payload?.exp)}`);
      }
      // Replace legacy verify with Supabase session check
      const { data: sessionRes2, error: sessionErr2 } = await supabase.auth.getSession();
      if (sessionErr2 || !sessionRes2.session) throw sessionErr2 || new Error('No Supabase session');
      setVerifyStatus('ok');
      log('✅ Supabase session verified');
    } catch (e: any) {
      setVerifyStatus('fail');
      log(`❌ Checklist: ${e?.message || String(e)}`);
    }
  }, [desktopMode, log]);

  if (desktopMode) {
    const onLogin = async () => { try { await openHostedSignIn('metapip://auth/callback'); } catch {} };
    return (
      <>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={onLogin} className="px-3 py-2 rounded bg-emerald-600 text-white">ورود</button>
          <button onClick={runChecklist} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">اجرای چک‌لیست</button>
          <Link href="/diagnostics" className="px-3 py-2 rounded bg-gray-700 text-white">عیب‌یابی پیشرفته</Link>
        </div>
        <div className="mb-6 p-4 rounded-lg border bg-white dark:bg-zinc-900" dir="rtl">
          <div className="font-semibold mb-2">تست اتصال (بدون ClerkProvider)</div>
          <div className="flex items-center gap-2">
            <button disabled={testing} onClick={run} className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50">
              {testing ? 'در حال تست…' : 'اجرای تست JWT → Supabase'}
            </button>
            <button disabled={testing} onClick={runTauriVerify} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
              {testing ? 'در حال تست…' : 'تست تأیید JWT در Tauri'}
            </button>
          </div>
          <div className="mt-3 p-3 rounded bg-gray-100 dark:bg-zinc-800 text-sm whitespace-pre-wrap" dir="auto">
            {logs.length === 0 ? 'خروجی تست در اینجا نمایش داده می‌شود' : logs.join('\n')}
          </div>
        </div>
        <div className="mb-6 p-4 rounded-lg border bg-white dark:bg-zinc-900" dir="rtl">
          <div className="font-semibold mb-2">تست رجیستر و دیپ‌لینک</div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={registerDeepLink} className="px-3 py-2 rounded bg-purple-600 text-white">ثبت/بررسی پروتکل metapip</button>
            <button onClick={openTestDeepLink} className="px-3 py-2 rounded bg-rose-600 text-white">باز کردن لینک آزمایشی metapip://</button>
            <button onClick={copyHostedLink} className="px-3 py-2 rounded border border-gray-300 dark:border-zinc-700">کپی لینک ورود Hosted</button>
          </div>
          <div className="mt-3 text-xs opacity-80 select-all">
            {buildHostedUrl()}
          </div>
        </div>
        <div className="mb-6 p-4 rounded-lg border bg-white dark:bg-zinc-900" dir="rtl">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">لاگ‌های حیاتی احراز هویت</div>
            <div className="flex items-center gap-2">
              <button onClick={() => { try { diagClear(); } catch {} }} className="px-2 py-1 rounded border border-gray-300 dark:border-zinc-700 text-xs">پاک کردن</button>
              <Link href="/diagnostics" className="px-2 py-1 rounded bg-gray-200 dark:bg-zinc-700 text-xs">جزئیات بیشتر</Link>
            </div>
          </div>
          <div className="max-h-64 overflow-auto text-xs space-y-1">
            {diagLogs.length === 0 && <div className="opacity-70">لاگی ثبت نشده است.</div>}
            {diagLogs.map((l) => (
              <div key={l.id} className="flex gap-2 items-start">
                <span className="opacity-60 whitespace-nowrap">{new Date(l.ts).toLocaleTimeString()}</span>
                <span className={`font-semibold ${l.level === 'error' ? 'text-red-600' : l.level === 'warn' ? 'text-amber-600' : l.level === 'success' ? 'text-emerald-600' : 'text-gray-600'}`}>{l.level.toUpperCase()}</span>
                <span className="">{l.message}</span>
                {l.data && <pre className="ml-auto opacity-70 overflow-auto max-w-[50%]">{JSON.stringify(l.data, null, 2)}</pre>}
              </div>
            ))}
          </div>
        </div>
        <Dashboard />
      </>
    );
  }

  return (
    <>
      <SignedIn>
        {showWelcome && (
          <div className="mb-6 p-4 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" dir="rtl">
            <div className="font-semibold mb-1">ثبت‌نام با موفقیت انجام شد 🎉</div>
            <div className="text-sm opacity-90">برای اطمینان از آماده‌بودن محیط، می‌توانید تست‌های زیر را اجرا کنید.</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button disabled={testing} onClick={run} className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50">
                {testing ? 'در حال تست…' : 'تست Clerk → Supabase'}
              </button>
              <button disabled={testing} onClick={runChecklist} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">
                {testing ? 'در حال تست…' : 'اجرای چک‌لیست Tauri/Supabase'}
              </button>
              <div>SUPABASE_ANON_KEY: {envStatus?.SUPABASE_ANON_KEY ? '✅' : isTauri ? '❌' : 'N/A'}</div>
              <div>SUPABASE_FUNCTIONS_URL: {envStatus?.SUPABASE_FUNCTIONS_URL ? '✅' : isTauri ? '❌' : 'N/A'}</div>
              <div>SUPABASE_API_KEY: {envStatus?.SUPABASE_API_KEY ? '✅' : isTauri ? '❌' : 'N/A'}</div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={runChecklist} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">اجرای چک‌لیست</button>
            </div>
          </div>
        )}
        <div className="mb-6 p-4 rounded-lg border bg-white dark:bg-zinc-900" dir="rtl">
          <div className="font-semibold mb-2">تست اتصال Clerk → Supabase</div>
          <div className="flex items-center gap-2">
            <button disabled={testing} onClick={run} className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50">
              {testing ? 'در حال تست…' : 'اجرای تست Clerk → Supabase'}
            </button>
            <button disabled={testing} onClick={runTauriVerify} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
              {testing ? 'در حال تست…' : 'تست تأیید JWT در Tauri'}
            </button>
          </div>
          <div className="mt-3 p-3 rounded bg-gray-100 dark:bg-zinc-800 text-sm whitespace-pre-wrap" dir="auto">
            {logs.length === 0 ? 'خروجی تست در اینجا نمایش داده می‌شود' : logs.join('\n')}
          </div>
        </div>
        <Dashboard />
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center gap-4 py-10">
          <h2 className="text-xl font-semibold">برای مشاهده داشبورد وارد شوید</h2>
          <div className="max-w-md w-full">
            <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
