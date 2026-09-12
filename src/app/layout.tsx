import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نزاهة التوظيف",
  description: "منصة رقمية لإدارة رحلة ما بعد القبول الوظيفي",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
