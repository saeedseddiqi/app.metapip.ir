import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';

// Load env from workspace root (../.env) so we have a single source of truth
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_ENV = path.resolve(__dirname, '../.env');
dotenv.config({ path: ROOT_ENV, override: true });

// Bridge non-public vars to NEXT_PUBLIC_* if developer only set server-side ones
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}
// If developer didn't set functions base explicitly, derive from SUPABASE_URL
if (!process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL && process.env.SUPABASE_URL) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL = `${base}/functions/v1`;
}

// Bridge Clerk variables to NEXT_PUBLIC_ for client usage
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_PUBLISHABLE_KEY) {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;
}
if (!process.env.NEXT_PUBLIC_CLERK_CLIENT_ID && process.env.CLERK_CLIENT_ID) {
  process.env.NEXT_PUBLIC_CLERK_CLIENT_ID = process.env.CLERK_CLIENT_ID;
}
if (!process.env.NEXT_PUBLIC_CLERK_BASE_URL && process.env.CLERK_BASE_URL) {
  process.env.NEXT_PUBLIC_CLERK_BASE_URL = process.env.CLERK_BASE_URL;
}
if (!process.env.NEXT_PUBLIC_CLERK_HOSTED_URL && process.env.CLERK_HOSTED_URL) {
  process.env.NEXT_PUBLIC_CLERK_HOSTED_URL = process.env.CLERK_HOSTED_URL;
}
if (!process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK && process.env.DESKTOP_DISABLE_CLERK) {
  process.env.NEXT_PUBLIC_DESKTOP_DISABLE_CLERK = process.env.DESKTOP_DISABLE_CLERK;
}
if (!process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED && process.env.SUPABASE_SESSION_ENABLED) {
  process.env.NEXT_PUBLIC_SUPABASE_SESSION_ENABLED = process.env.SUPABASE_SESSION_ENABLED;
}

const nextConfig: NextConfig = {
  // Middleware requires dynamic runtime; do not use static export
  reactStrictMode: true,
};

export default nextConfig;
