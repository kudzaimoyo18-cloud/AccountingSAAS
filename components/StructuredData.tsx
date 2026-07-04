import { FAQS, TIERS } from "@/lib/content";

const SITE = "https://mizan-tan.vercel.app";

export function StructuredData() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Mizan",
      url: SITE,
      description:
        "AI bookkeeping and accounting software for UAE free-zone companies — AI-drafted books you approve, with VAT and corporate-tax figures always filing-ready.",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "AED",
        lowPrice: TIERS[0].priceAed.replace(",", ""),
        highPrice: TIERS[TIERS.length - 1].priceAed.replace(",", ""),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
