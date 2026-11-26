import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Central hub MVP (astranov.eu) only — per-AI subdomain apps are separate repos/hosts.
  reactStrictMode: true,
  turbopack: {
    // Silence multi-lockfile root inference (repo root + web/).
    root: path.join(__dirname),
  },
};

export default nextConfig;
