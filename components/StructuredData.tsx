import { FAQS, TIERS } from "@/lib/content";

const SITE = "https://mizan-tan.vercel.app";

export function StructuredData() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: "Mizan",
      url: SITE,
      description:
        "AI-native accounting, VAT and corporate tax service for UAE free-zone companies.",
      areaServed: "AE",
      priceRange: `AED ${TIERS[0].priceAed}–${TIERS[TIERS.length - 1].priceAed}/month`,
      address: { "@type": "PostalAddress", addressCountry: "AE", addressLocality: "Dubai" },
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
