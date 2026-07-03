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
  title: "Mizan — Books balanced. Taxes ready. Done.",
  description:
    "AI bookkeeping software for UAE free-zone companies. Upload invoices and statements — AI drafts your double-entry books, you approve every line, VAT and corporate tax stay filing-ready.",
  openGraph: {
    title: "Mizan — AI bookkeeping for UAE free-zone companies",
    description:
      "Upload the paperwork, approve the AI-drafted lines, and your P&L, balance sheet, VAT and corporate-tax figures stay filing-ready. Fixed monthly fee.",
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
