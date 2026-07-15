import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

// Single all-business sans across the whole product — headings, body, and
// tabular figures (Cash Now design language). No serif anywhere.
const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
  // PWA: installable app metadata (manifest comes from app/manifest.ts)
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mizan",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1B16" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before paint: applies saved theme (or system preference) to avoid flash
const themeInit = `(function(){try{var t=localStorage.getItem("mizan-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
