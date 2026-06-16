import type { Metadata } from "next";
import { UkNav } from "@/components/uk/UkNav";
import { UkHero } from "@/components/uk/UkHero";
import { UkTrustBar } from "@/components/uk/UkTrustBar";
import { UkProblem } from "@/components/uk/UkProblem";
import { UkHowItWorks } from "@/components/uk/UkHowItWorks";
import { UkPricing } from "@/components/uk/UkPricing";
import { UkFaq } from "@/components/uk/UkFaq";
import { UkCtaSection } from "@/components/uk/UkCtaSection";
import { UkFooter } from "@/components/uk/UkFooter";
import { UkStructuredData } from "@/components/uk/UkStructuredData";
import { UK_SEO } from "@/lib/uk-content";

export const metadata: Metadata = {
  title: UK_SEO.title,
  description: UK_SEO.description,
  keywords: UK_SEO.keywords,
  alternates: { canonical: "/uk" },
  openGraph: {
    title: UK_SEO.title,
    description: UK_SEO.description,
    type: "website",
  },
};

export default function UkPage() {
  return (
    <>
      <UkStructuredData />
      <UkNav />
      <main>
        <UkHero />
        <UkTrustBar />
        <UkProblem />
        <UkHowItWorks />
        <UkPricing />
        <UkFaq />
        <UkCtaSection />
      </main>
      <UkFooter />
    </>
  );
}
