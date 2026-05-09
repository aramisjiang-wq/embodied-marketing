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

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://lf-package-cn.feishucdn.com https://su.bcebos.com;",
              "style-src 'self' 'unsafe-inline' https://lf-package-cn.feishucdn.com;",
              "img-src 'self' data: blob: https://*.feishucdn.com https://*.larksuite.com https://*.feishu.cn;",
              "font-src 'self' data:;",
              "connect-src 'self' https://open.feishu.cn https://*.feishu.cn https://*.larksuite.com;",
              "frame-src https://open.feishu.cn https://*.feishu.cn;",
              "frame-ancestors 'self' https://open.feishu.cn;",
            ].join(" "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
