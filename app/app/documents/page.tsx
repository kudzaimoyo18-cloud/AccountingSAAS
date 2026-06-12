import { redirect } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { uploadDocument } from "@/lib/actions";
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
  const { supabase, profile, company } = await getCompany();
  if (!company) redirect("/app/onboarding");
  const { error, ok } = await searchParams;

  const { data: docs } = await supabase
    .from("documents")
    .select("*")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <PortalShell active="/app/documents" isAdmin={profile?.role === "admin"}>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Invoices, receipts, bank statements — drop them here, we do the rest.
        </p>

        <form action={uploadDocument} className="card mt-8">
          <input type="hidden" name="company_id" value={company.id} />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="file"
              name="file"
              required
              className="field file:mr-3 file:rounded-lg file:border-0 file:bg-paper-dim file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
              aria-label="Choose file"
            />
            <select name="kind" className="field sm:w-44" defaultValue="invoice" aria-label="Document type">
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary">Upload</button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
          {ok && <p className="mt-3 text-sm text-evergreen">Uploaded. We&apos;ll process it shortly.</p>}
          <p className="mt-3 text-xs text-ink-soft">PDF, images, or spreadsheets. Max 15MB.</p>
        </form>

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
    </PortalShell>
  );
}
