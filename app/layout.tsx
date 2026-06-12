import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mizan-tan.vercel.app"),
  keywords: [
    "UAE corporate tax",
    "free zone accounting",
    "VAT filing UAE",
    "Dubai bookkeeping",
    "FTA tax agent",
    "corporate tax registration UAE",
  ],
  title: "Mizan — Books balanced. Taxes filed. Done.",
  description:
    "AI-native accounting, VAT and corporate tax for UAE free-zone companies. We do the work — you get clean books and on-time filings. Fixed monthly fee.",
  openGraph: {
    title: "Mizan — Accounting & tax, done for you",
    description:
      "AI-native bookkeeping, VAT and corporate tax for UAE free-zone companies. Fixed monthly fee, reviewed by a licensed FTA tax agent.",
    type: "website",
  },
};

// Runs before paint: applies saved theme (or system preference) to avoid flash
const themeInit = `(function(){try{var t=localStorage.getItem("mizan-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
