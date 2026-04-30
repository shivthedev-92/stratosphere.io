import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stratosphere — Your Productivity Coach",
  description: "Build habits, manage your day, and find your rhythm — guilt-free.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
