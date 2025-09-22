import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, NextFetchEvent } from "next/server";

function isDesktopModeFlag(): boolean {
  const v = String(process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK || process.env.DESKTOP_DISABLE_CLERK || "0")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  const publicPaths = ["/sign-in", "/sign-up", "/oauth-bridge", "/api", "/test-auth"];
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic) return NextResponse.next();

  if (isDesktopModeFlag()) return NextResponse.next();

  const hasClerkSecret = !!process.env.CLERK_SECRET_KEY;
  const hasPublishable = !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY);
  if (!hasClerkSecret || !hasPublishable) return NextResponse.next();

  try {
    const handler = clerkMiddleware(async (auth, r) => {
      const { userId, redirectToSignIn } = await auth();
      if (!userId) return redirectToSignIn({ returnBackUrl: r.url });
      return NextResponse.next();
    });
    return handler(req, ev);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
