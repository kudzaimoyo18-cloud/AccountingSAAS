import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { getProfile } from "@/lib/portal";
import {
  addComplianceItem,
  setComplianceStatus,
  markDocProcessed,
  setCompanyStatus,
} from "@/lib/admin-actions";

export const metadata = { title: "Client — Mizan Admin" };

export default async function AdminCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase, profile } = await getProfile();
  if (profile?.role !== "admin") redirect("/app");

  const { id } = await params;
  const { error } = await searchParams;

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!company) notFound();

  const [{ data: items }, { data: docs }] = await Promise.all([
    supabase
      .from("compliance_items")
      .select("*")
      .eq("company_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <PortalShell active="/admin" isAdmin>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {company.name}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {company.free_zone ?? "—"} · {company.plan} plan · license{" "}
          <span className="tnum">{company.license_no ?? "—"}</span>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href={`/admin/${company.id}/ledger`} className="btn-primary px-3 py-1.5 text-xs">
            Open AI ledger
          </Link>
          <StatusBadge status={company.status} />
          <form action={setCompanyStatus} className="flex items-center gap-2">
            <input type="hidden" name="company_id" value={company.id} />
            <select
              name="status"
              defaultValue={company.status}
              className="field w-40 px-3 py-1.5 text-xs"
              aria-label="Company status"
            >
              <option value="onboarding">Onboarding</option>
              <option value="active">Active (paid)</option>
              <option value="paused">Paused</option>
            </select>
            <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
              Update
            </button>
          </form>
        </div>

        <h2 className="mt-10 font-display text-xl font-medium">Compliance items</h2>

        <form action={addComplianceItem} className="card mt-4">
          <input type="hidden" name="company_id" value={company.id} />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <input name="title" required placeholder="e.g. VAT return Q3 2026" className="field" aria-label="Item title" />
            <select name="kind" className="field sm:w-40" defaultValue="vat_return" aria-label="Kind">
              <option value="vat_return">VAT return</option>
              <option value="corporate_tax">Corporate tax</option>
              <option value="bookkeeping">Bookkeeping</option>
              <option value="registration">Registration</option>
              <option value="other">Other</option>
            </select>
            <input name="due_date" type="date" className="field sm:w-40" aria-label="Due date" />
            <button type="submit" className="btn-primary">Add</button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </form>

        {(items ?? []).length === 0 ? (
          <p className="mt-6 text-sm text-ink-soft">No items yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
            {(items ?? []).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="tnum mt-0.5 text-xs text-ink-soft">
                    {item.kind}
                    {item.due_date &&
                      ` · due ${new Date(item.due_date).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  <form action={setComplianceStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="company_id" value={company.id} />
                    <select
                      name="status"
                      defaultValue={item.status}
                      className="field w-36 px-3 py-1.5 text-xs"
                      aria-label="Set status"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="in_progress">In progress</option>
                      <option value="filed">Filed</option>
                      <option value="overdue">Overdue</option>
                    </select>
                    <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">Set</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-10 font-display text-xl font-medium">Documents</h2>
        {(docs ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">No documents uploaded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.original_name}</p>
                  <p className="tnum mt-0.5 text-xs text-ink-soft">
                    {d.kind} · {new Date(d.created_at).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  {d.status === "new" && (
                    <form action={markDocProcessed}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="company_id" value={company.id} />
                      <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                        Mark processed
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
