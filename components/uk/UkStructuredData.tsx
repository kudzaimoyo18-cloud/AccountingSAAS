import { UK_FAQS, UK_TIERS } from "@/lib/uk-content";

const SITE = "https://mizan-tan.vercel.app/uk";

export function UkStructuredData() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: "Mizan UK",
      url: SITE,
      description:
        "AI-native bookkeeping, VAT and Making Tax Digital service for UK freelancers and sole traders.",
      areaServed: "GB",
      priceRange: `£${UK_TIERS[0].price}–£${UK_TIERS[UK_TIERS.length - 1].price}/month`,
      address: { "@type": "PostalAddress", addressCountry: "GB" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: UK_FAQS.map((f) => ({
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
