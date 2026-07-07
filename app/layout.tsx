import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "华徽智能工作台",
  description: "飞书多维表与 Dify 工作流统一入口"
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
