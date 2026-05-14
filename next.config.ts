import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    '21.0.4.136:3000',
    '127.0.0.1:3000',
    'localhost:81',
  ],
};

export default nextConfig;
