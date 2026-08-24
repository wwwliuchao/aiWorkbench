import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "华徽智能工作台",
  description: "飞书多维表与 Dify 工作流统一入口",
  icons: {
    icon: `${basePath}/assets/huahui-brand/huahui-logo.png`
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
