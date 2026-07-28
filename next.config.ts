import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  allowedDevOrigins: [
    '21.0.4.136:3000',
    '127.0.0.1:3000',
    'localhost:81',
  ],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        // These directives do not require weakening Next.js's script policy,
        // but still prevent plugin execution, base-tag URL rewriting and
        // third-party framing in deployments not fronted by Caddy.
        { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'" },
      ],
    }];
  },
};

export default nextConfig;
