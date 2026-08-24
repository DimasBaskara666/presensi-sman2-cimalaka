import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Multipart overhead sits above the application-level 5 MB workbook limit.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
