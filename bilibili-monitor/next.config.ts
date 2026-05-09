import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.feishucdn.com",
      },
      {
        protocol: "https",
        hostname: "**.larksuite.com",
      },
      {
        protocol: "https",
        hostname: "**.feishu.cn",
      },
    ],
  },
};

export default nextConfig;
