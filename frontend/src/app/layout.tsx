// ############################################################################
// #    _____ __             __                   __                     _     
// #   / ___// /__________ _/ /_____  _________  / /_  ___  ________    (_)___ 
// #   \__ \/ __/ ___/ __ `/ __/ __ \/ ___/ __ \/ __ \/ _ \/ ___/ _ \  / / __ \
// #  ___/ / /_/ /  / /_/ / /_/ /_/ (__  ) /_/ / / / /  __/ /  /  __/ / / /_/ /
// # /____/\__/_/   \__,_/\__/\____/____/ .___/_/ /_/\___/_/   \___(_)_/\____/ 
// #                                   /_/                                     
// ############################################################################
// # Copyright (c) 2024. Sivarajan kakamaniyan. All rights reserved.
// # Statosphere is a product of Sivarajan Kakamaniyan. 
// # Unauthorized copying of this file, via any medium is strictly prohibited.
// # Version 0.1.0 | 2024-06
// ############################################################################


import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";

// Design system type: Instrument Sans for UI, Newsreader italic for the daily
// quote and journal text. Exposed as CSS variables used by globals.css.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stratosphere — Your Productivity Coach",
  description: "Build habits, manage your day, and find your rhythm — guilt-free.",
  // Icons come from the app/ file conventions: icon.svg, apple-icon.png, favicon.ico.
};


/*
Root Layout for the Stratosphere application. 
This component wraps all pages and provides the basic HTML structure and global styles. 
It also sets the metadata for the application, including the title and description, 
which are important for SEO and social sharing.
*/

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the theme script sets data-theme before React
    // hydrates, so the attribute intentionally differs from the server HTML.
    <html
      lang="en"
      className={`${instrumentSans.variable} ${newsreader.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
