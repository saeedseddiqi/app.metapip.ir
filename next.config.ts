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

const nextConfig: NextConfig = {
  // Middleware requires dynamic runtime; do not use static export
  reactStrictMode: true,
};

export default nextConfig;
