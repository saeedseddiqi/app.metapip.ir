import type { NextConfig } from 'next';
// Static SPA export configuration. No runtime .env loading or bridging here.
// Provide all required NEXT_PUBLIC_* variables via your hosting/build environment.

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disable Image Optimization for static export
  images: { unoptimized: true },
};

export default nextConfig;
