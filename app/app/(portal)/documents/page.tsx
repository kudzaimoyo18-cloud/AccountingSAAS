import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { DocumentUploadForm } from "@/components/app/DocumentUploadForm";
import { getCompany } from "@/lib/portal";

export const metadata = { title: "Documents — Mizan" };

const KINDS = [
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "other", label: "Other" },
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { supabase, company } = await getCompany();
  if (!company) redirect("/app/onboarding");
  const { error, ok } = await searchParams;

  const { data: docs } = await supabase
    .from("documents")
    .select("*")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl">
        <p className="text-sm text-ink-soft">
          Invoices, receipts, bank statements — drop them here, we do the rest.
        </p>

        <DocumentUploadForm companyId={company.id} serverError={error} serverOk={Boolean(ok)} />

        {(docs ?? []).length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink-soft">No documents yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.original_name}</p>
                  <p className="tnum mt-0.5 text-xs text-ink-soft">
                    {KINDS.find((k) => k.value === d.kind)?.label ?? d.kind} ·{" "}
                    {new Date(d.created_at).toLocaleDateString("en-AE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
  );
}
