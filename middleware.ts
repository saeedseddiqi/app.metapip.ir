import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Protect specific routes (dashboard and other private areas)
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }
}, {
  // Ensure users are sent to the dedicated Accounts domain for auth
  signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || 'https://accounts.metapip.ir/sign-in',
});

// Only run middleware on selected paths
export const config = {
  matcher: [
    // Skip static files, images, and Next internals
    '/((?!_next|.*\..*|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
