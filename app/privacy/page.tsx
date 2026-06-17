import Link from "next/link";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Privacy Policy — Mizan",
  description: "How Mizan collects, uses, and protects your personal and business data.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated="17 June 2026"
      intro="This policy explains what data Mizan collects, how we use it, who processes it, and the rights you have over it."
    >
      <LegalSection heading="1. Who controls your data">
        <p>
          The data controller is [LEGAL ENTITY NAME], registered in [England &amp; Wales] under company number
          [00000000], registered office [registered address]. For any privacy matter contact
          [privacy@yourdomain]. Our UK ICO registration reference is [ICO ref — once registered].
        </p>
      </LegalSection>

      <LegalSection heading="2. What we collect">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><span className="font-medium text-ink">Account data</span> — your name, email address, and authentication identifiers.</li>
          <li><span className="font-medium text-ink">Business financial data</span> — bank statement files you upload, transactions, payees, amounts, VAT details, and company information you enter.</li>
          <li><span className="font-medium text-ink">Usage and technical data</span> — logs, device and browser information, and basic analytics.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How we use it, and our lawful basis">
        <p>We use your data to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>provide the service to you (performance of our contract);</li>
          <li>categorise your transactions, including by automated and AI processing (our legitimate interest in providing the core feature, and performance of our contract);</li>
          <li>secure, maintain, and improve the service (legitimate interest); and</li>
          <li>communicate with you about your account (legitimate interest / contract).</li>
        </ul>
        <p>We do not sell your data, and we do not use your financial data to advertise to you.</p>
      </LegalSection>

      <LegalSection heading="4. Automated and AI processing">
        <p>
          To suggest a category, transaction lines that our rules are not confident about — the description,
          amount, and payee — may be sent to our AI sub-processor (Anthropic) for analysis. The result is a
          suggestion that you review and approve; we do not make automated decisions that produce legal effects
          about you without your review.
        </p>
      </LegalSection>

      <LegalSection heading="5. Who processes data on our behalf (sub-processors)">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><span className="font-medium text-ink">Supabase</span> — database, authentication, and file storage.</li>
          <li><span className="font-medium text-ink">Vercel</span> — application hosting and basic analytics.</li>
          <li><span className="font-medium text-ink">Anthropic</span> — AI categorisation of low-confidence transactions.</li>
        </ul>
        <p>Each processes data on our behalf under a written agreement.</p>
      </LegalSection>

      <LegalSection heading="6. International transfers">
        <p>
          Some processing may take place outside your country (for example, AI processing by Anthropic in the
          United States). Where personal data is transferred internationally, we rely on appropriate safeguards
          such as Standard Contractual Clauses.
        </p>
      </LegalSection>

      <LegalSection heading="7. Storage and security">
        <p>
          Your data is stored with Supabase ([hosting region]). Each company&rsquo;s data is isolated using
          row-level security, transmitted over encrypted connections, and protected by access controls. No
          method of storage or transmission is completely secure, but we take reasonable measures to protect
          your data.
        </p>
      </LegalSection>

      <LegalSection heading="8. How long we keep it">
        <p>
          We keep your data while your account is active and for as long as needed for legal and record-keeping
          purposes. You can ask us to delete your data, subject to any retention we are legally required to
          apply.
        </p>
      </LegalSection>

      <LegalSection heading="9. Your rights">
        <p>
          Under UK GDPR and, where it applies, the UAE Personal Data Protection Law, you have the right to
          access, correct, delete, restrict, or port your data, and to object to certain processing or withdraw
          consent. To exercise any right, contact [privacy@yourdomain]. You also have the right to complain to
          the UK Information Commissioner&rsquo;s Office (ico.org.uk) or the UAE Data Office.
        </p>
      </LegalSection>

      <LegalSection heading="10. Cookies">
        <p>
          We use essential cookies for sign-in and minimal analytics. We do not use advertising or
          cross-site tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="11. Data breaches">
        <p>
          If a breach affects your personal data, we will notify you and the relevant regulator where the law
          requires it, without undue delay.
        </p>
      </LegalSection>

      <LegalSection heading="12. Changes to this policy">
        <p>We will post any update here with a new &ldquo;last updated&rdquo; date.</p>
      </LegalSection>

      <LegalSection heading="13. Contact">
        <p>
          Privacy questions: [privacy@yourdomain]. See also our{" "}
          <Link href="/terms" className="underline hover:text-ink">Terms of Service</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
