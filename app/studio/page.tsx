import type { Metadata } from "next";
import { StudioApp } from "@/components/studio/StudioApp";

export const metadata: Metadata = {
  title: "Mizan Studio — live bookkeeping demo",
  description:
    "Interactive demo: import a bank statement and watch Mizan categorise, VAT-split, and produce filing-ready accounts for UAE and UK clients.",
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <StudioApp />;
}
