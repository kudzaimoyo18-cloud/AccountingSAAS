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
        <BooksTabs active="import" reviewCount={reviewCount} />
        <p className="mt-4 text-sm text-ink-soft">
          Upload a CSV. Mizan auto-categorises every line, splits VAT, and flags only what needs a human.
        </p>

        {error && (
          <p role="alert" className="alert-banner alert-banner-danger mt-4">
            {error.replace(/\+/g, " ")}
          </p>
        )}

        <ImportWizard />
        <ControlNotice className="mt-6" />
      </div>
  );
}
