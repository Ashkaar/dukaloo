import type { NextConfig } from "next";

// Every page depends on the shop (from the address) and the signed-in user
// (from a cookie), so pages render per request. Cache Components and
// partial prefetching are left off on purpose.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
