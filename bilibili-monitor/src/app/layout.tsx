import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "B站竞品监控",
  description: "机器人品牌B站矩阵监控系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
