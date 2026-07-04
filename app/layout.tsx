import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediCheck AI",
  description: "병원 방문 전 증상 정리를 돕는 AI 사전 문진 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
