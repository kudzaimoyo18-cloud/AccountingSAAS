import Link from "next/link";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";

// Public, unauthenticated page describing how to delete a Mizan account.
//
// Google Play requires this URL for the Data safety form: a page anyone can
// reach WITHOUT signing in or installing the app, stating what deleting an
// account removes and what (if anything) is kept. The in-app path lives in
// Settings — see components/app/DeleteAccount.tsx.

export const metadata = {
  title: "Delete your account — Mizan",
  description:
    "How to permanently delete your Mizan account and everything stored with it.",
};

export default function AccountDeletionPage() {
  return (
    <LegalLayout
      title="Delete your account"
      lastUpdated="5 September 2026"
      intro="You can delete your Mizan account yourself, at any time, without asking us. Here is exactly how, and exactly what it removes."
    >
      <LegalSection heading="1. Delete it from inside Mizan">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Sign in at <Link href="/login" className="text-evergreen-deep underline underline-offset-4">mizan-tan.vercel.app</Link>, or open the Mizan app.</li>
          <li>Go to <span className="font-medium text-ink">Profile → Settings</span>.</li>
          <li>Under <span className="font-medium text-ink">Delete account</span>, choose <span className="font-medium text-ink">Delete my account</span>.</li>
          <li>Type <span className="font-mono font-bold">DELETE</span> to confirm.</li>
        </ol>
        <p>
          The deletion happens immediately. You are signed out, and you will not be able to sign back in
          with that account.
        </p>
      </LegalSection>

      <LegalSection heading="2. What is deleted">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Your account, sign-in credentials, and any linked Google sign-in.</li>
          <li>Every company you own, and all of its books — ledger entries, journals, chart of accounts, invoices, customers, bank transactions and tax packs.</li>
          <li>Every file you uploaded — receipts, bank statements and other documents — removed from our storage.</li>
          <li>Your profile, name and email address.</li>
        </ul>
        <p>None of this is recoverable afterwards. We cannot restore it for you, so export anything you need first.</p>
      </LegalSection>

      <LegalSection heading="3. What is not deleted, and why">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-medium text-ink">Books belonging to someone else&rsquo;s company.</span> If you
            were invited as an accountant or tax agent, that company&rsquo;s records belong to its owner and stay
            with them. Your membership is removed and your name is detached from anything you created there.
          </li>
          <li>
            <span className="font-medium text-ink">Records we are legally required to keep.</span> Where UAE law
            requires retention of specific accounting or tax records, we keep only what the law requires, for only
            as long as it requires.
          </li>
          <li>
            <span className="font-medium text-ink">Server logs.</span> Operational logs containing technical data
            expire on their normal retention schedule.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. If you cannot sign in">
        <p>
          Email <a href="mailto:kudzaimoyo18@gmail.com" className="text-evergreen-deep underline underline-offset-4">kudzaimoyo18@gmail.com</a>{" "}
          from the address on the account and ask for deletion. We will verify the request and delete the account
          within 30 days.
        </p>
      </LegalSection>

      <LegalSection heading="5. Related">
        <p>
          See the <Link href="/privacy" className="text-evergreen-deep underline underline-offset-4">Privacy Policy</Link> for
          what we collect and how long we keep it, and the{" "}
          <Link href="/terms" className="text-evergreen-deep underline underline-offset-4">Terms</Link> for your rights to
          your data.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
