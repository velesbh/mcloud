import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "cdn.modrinth.com" },
      { hostname: "img.clerk.com" },
      { hostname: "images.clerk.dev" },
    ],
  },
};

export default withNextIntl(nextConfig);
