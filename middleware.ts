import { clerkMiddleware } from "@clerk/nextjs/server";

// Dynamic server-side redirect using runtime envs API
// If DESKTOP_DISABLE_CLERK is enabled via remote envs, skip redirects (desktop mode)
const REMOTE_ENVS_URL = "https://metapip-envs.vercel.app/api/envs";
const CACHE_TTL_MS = 60_000; // 60s TTL for envs in middleware

type RemoteEnvItem = { key: string; value: string; is_secret?: boolean | null };

let _cache: { map: Record<string, string>; ts: number } | null = null;

async function fetchEnvMap(): Promise<Record<string, string>> {
  try {
    const now = Date.now();
    if (_cache && now - _cache.ts < CACHE_TTL_MS) {
      return _cache.map;
    }
    const res = await fetch(REMOTE_ENVS_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) return {};
    const json = await res.json().catch(() => ({} as any));
    const items: RemoteEnvItem[] = Array.isArray(json?.envs) ? json.envs : [];
    const map: Record<string, string> = {};
    for (const it of items) {
      if (it?.is_secret) continue; // never expose secrets in middleware logic
      const k = String(it?.key || "").trim();
      if (k) map[k] = String((it as any)?.value ?? "");
    }
    _cache = { map, ts: now };
    return map;
  } catch {
    return {};
  }
}

function isDesktopModeFrom(map: Record<string, string>): boolean {
  const v = String(map["DESKTOP_DISABLE_CLERK"] || "0").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  // Public routes that should never redirect
  const publicPaths = [
    "/sign-in",
    "/sign-up",
    "/oauth-bridge",
    "/api",
    "/test-auth",
  ];
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic) return;

  // Decide behavior from remote envs
  const envMap = await fetchEnvMap();
  if (isDesktopModeFrom(envMap)) {
    // Desktop mode: do not enforce server-side redirect; desktop deep-link handles auth
    return;
  }
  const { userId, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

export const runtime = "nodejs";
