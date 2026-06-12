import { redirect } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { getCompany } from "@/lib/portal";

export const metadata = { title: "Overview — Mizan" };

const KIND_LABELS: Record<string, string> = {
  vat_return: "VAT return",
  corporate_tax: "Corporate tax",
  bookkeeping: "Bookkeeping",
  registration: "Registration",
  other: "Task",
};

export default async function DashboardPage() {
  const { supabase, profile, company } = await getCompany();
  if (!company) redirect("/app/onboarding");

  const [{ data: items }, { count: docCount }] = await Promise.all([
    supabase
      .from("compliance_items")
      .select("*")
      .eq("company_id", company.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id),
  ]);

  const open = (items ?? []).filter((i) => i.status !== "filed");
  const overdue = open.filter((i) => i.status === "overdue");
  const nextDue = open.find((i) => i.due_date);

  return (
    <PortalShell active="/app" isAdmin={profile?.role === "admin"}>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {company.name}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {company.free_zone ?? "UAE"} · {company.plan} plan
            </p>
          </div>
          <StatusBadge status={overdue.length > 0 ? "overdue" : company.status} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Open items</p>
            <p className="tnum mt-2 font-display text-4xl font-semibold">{open.length}</p>
          </div>
          <div className="card">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Next deadline</p>
            <p className="tnum mt-2 font-display text-4xl font-semibold">
              {nextDue?.due_date
                ? new Date(nextDue.due_date).toLocaleDateString("en-AE", {
                    day: "numeric",
                    month: "short",
                  })
                : "—"}
            </p>
          </div>
          <div className="card">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Documents</p>
            <p className="tnum mt-2 font-display text-4xl font-semibold">{docCount ?? 0}</p>
          </div>
        </div>

        <h2 className="mt-10 font-display text-xl font-medium">Compliance</h2>
        {(items ?? []).length === 0 ? (
          <div className="card mt-4 text-center">
            <p className="font-display text-lg font-medium">We&apos;re setting up your file</p>
            <p className="mt-2 text-sm text-ink-soft">
              Your compliance calendar appears here once our team finishes onboarding —
              usually within one business day. Upload your documents to speed it up.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {(items ?? []).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {KIND_LABELS[item.kind] ?? item.kind}
                    {item.due_date && (
                      <span className="tnum">
                        {" · due "}
                        {new Date(item.due_date).toLocaleDateString("en-AE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
