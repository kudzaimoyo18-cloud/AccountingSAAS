import Link from "next/link";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Terms of Service — Mizan",
  description: "The terms that govern your use of Mizan bookkeeping software.",
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      lastUpdated="3 July 2026"
      intro="These terms govern your use of Mizan. By creating an account or using the software, you agree to them."
    >
      <LegalSection heading="1. Who we are">
        <p>
          Mizan is a software product operated by Kudzai Moyo, an individual based in Dubai, United Arab
          Emirates, trading as &ldquo;Mizan&rdquo; (&ldquo;Mizan&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
          You can reach us at kudzaimoyo18@gmail.com. If Mizan is later transferred to a registered company,
          we will update these terms with that company&rsquo;s details.
        </p>
      </LegalSection>

      <LegalSection heading="2. What Mizan is — and what it is not">
        <p>
          Mizan is software that helps you prepare your own bookkeeping: import bank statements, categorise
          transactions, split VAT, produce profit-and-loss and VAT summaries, and export an accounts pack.
        </p>
        <p>
          <span className="font-medium text-ink">Mizan is not an accountant, auditor, or tax agent, and does
          not provide accounting, tax, legal, or financial advice.</span> We do not file returns or submit
          anything to any tax authority (including the UAE Federal Tax Authority or HMRC) on your behalf. You
          remain the keeper of your own records. Where filing is required, you do it yourself or instruct a
          separately licensed accountant or tax agent.
        </p>
      </LegalSection>

      <LegalSection heading="3. Your responsibilities">
        <p>You are responsible for:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>the accuracy and completeness of the data you upload or enter;</li>
          <li>reviewing and approving every category, VAT treatment, and figure before you treat your books as final;</li>
          <li>the correctness and timeliness of any return or filing you make;</li>
          <li>keeping records for as long as the law requires; and</li>
          <li>any decision you make on the basis of Mizan&rsquo;s output.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Automated and AI-generated suggestions">
        <p>
          Mizan uses automated rules and artificial intelligence to suggest categories and VAT treatment.
          These suggestions can be wrong, incomplete, or out of date. They are suggestions only and require
          your review and approval. We do not warrant the accuracy of any suggestion, and you must not rely on
          one without checking it.
        </p>
      </LegalSection>

      <LegalSection heading="5. Your account and acceptable use">
        <p>
          Keep your login credentials secure and do not share them. You agree not to misuse the service,
          including by attempting to reverse-engineer it, disrupt it, access data that is not yours, or upload
          unlawful content.
        </p>
      </LegalSection>

      <LegalSection heading="6. Free and beta access">
        <p>
          Mizan may be provided free of charge or as a beta. Features may change, be limited, or be withdrawn
          at any time. Free and beta access is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;.
        </p>
      </LegalSection>

      <LegalSection heading="7. Availability and warranties">
        <p>
          We work to keep the service running but do not warrant that it will be uninterrupted, error-free, or
          fit for any particular purpose. To the maximum extent permitted by law, all implied warranties are
          excluded.
        </p>
      </LegalSection>

      <LegalSection heading="8. Limitation of liability">
        <p>
          To the maximum extent permitted by law, we are not liable for indirect or consequential loss, loss
          of profit, loss of data, or for any tax, penalty, or interest assessed against you — including any
          loss arising from a suggestion you did not review. Our total aggregate liability is limited to the
          greater of the amount you paid us in the 12 months before the claim or AED 500.
        </p>
        <p>
          Nothing in these terms excludes liability that cannot be excluded by law, such as liability for death
          or personal injury caused by negligence, or for fraud.
        </p>
      </LegalSection>

      <LegalSection heading="9. Your data">
        <p>
          We handle your personal and business data as described in our{" "}
          <Link href="/privacy" className="underline hover:text-ink">Privacy Policy</Link>. By using Mizan you
          agree to that handling.
        </p>
      </LegalSection>

      <LegalSection heading="10. Termination">
        <p>
          You may stop using Mizan and close your account at any time. We may suspend or end your access if you
          breach these terms. On termination you may request an export of your data before it is deleted.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to these terms">
        <p>
          We may update these terms from time to time. We will post the updated version here with a new
          &ldquo;last updated&rdquo; date. Continuing to use Mizan after a change means you accept it.
        </p>
      </LegalSection>

      <LegalSection heading="12. Governing law">
        <p>
          These terms are governed by the federal laws of the United Arab Emirates as applied in the Emirate
          of Dubai, and the courts of Dubai have exclusive jurisdiction over any dispute.
        </p>
      </LegalSection>

      <LegalSection heading="13. Contact">
        <p>Questions about these terms: kudzaimoyo18@gmail.com.</p>
      </LegalSection>
    </LegalLayout>
  );
}
