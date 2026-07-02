import { redirect } from "next/navigation";
import { BooksTabs } from "@/components/books/BooksTabs";
import { ImportWizard } from "@/components/books/ImportWizard";
import { ControlNotice } from "@/components/books/ControlNotice";
import { getActiveCompany, listTransactions } from "@/lib/books/repo";

export const metadata = { title: "Import — Mizan Books" };

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const { error } = await searchParams;
  const txns = await listTransactions(company.id);
  const reviewCount = txns.filter((t) => t.status === "review").length;

  return (
    <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Import</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Import a bank statement</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Upload a CSV. Mizan auto-categorises every line, splits VAT, and flags only what needs a human.
        </p>

        <div className="mt-6">
          <BooksTabs active="import" reviewCount={reviewCount} />
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error.replace(/\+/g, " ")}
          </p>
        )}

        <ImportWizard />
        <ControlNotice className="mt-6" />
      </div>
  );
}
