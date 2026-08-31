import Link from "next/link";
import { PortalShell } from "@/components/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies as companiesTable, complianceItems } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";
import { setCompanyStatus } from "@/lib/admin-actions";

export const metadata = { title: "Admin — Mizan" };

export default async function AdminPage() {
  await requireAdmin();

  // Deliberately cross-tenant: this is the admin client list. The open/overdue
  // counts are aggregated in SQL rather than by pulling every compliance row.
  const companies = await db
    .select({
      id: companiesTable.id,
      name: companiesTable.name,
      free_zone: companiesTable.freeZone,
      plan: companiesTable.plan,
      status: companiesTable.status,
      open: sql<number>`count(*) filter (where ${complianceItems.status} is not null
        and ${complianceItems.status} <> 'filed')`.mapWith(Number),
      overdue: sql<boolean>`bool_or(${complianceItems.status} = 'overdue')`,
    })
    .from(companiesTable)
    .leftJoin(complianceItems, eq(complianceItems.companyId, companiesTable.id))
    .groupBy(companiesTable.id)
    .orderBy(desc(companiesTable.createdAt));

  return (
    <PortalShell active="/admin" isAdmin>
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Clients</h1>
        <p className="tnum mt-1 text-sm text-ink-soft">
          {companies.length} companies
        </p>

        {companies.length === 0 ? (
          <p className="mt-10 text-sm text-ink-soft">No clients yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
            {companies.map((c) => {
              const open = c.open ?? 0;
              const overdue = Boolean(c.overdue);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <Link
                    href={`/admin/${c.id}`}
                    className="min-w-0 flex-1 transition-opacity hover:opacity-70"
                  >
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {c.free_zone ?? "—"} · {c.plan} ·{" "}
                      <span className="tnum">{open} open</span>
                    </p>
                  </Link>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={overdue ? "overdue" : c.status} />
                    {c.status !== "active" && (
                      <form action={setCompanyStatus}>
                        <input type="hidden" name="company_id" value={c.id} />
                        <input type="hidden" name="status" value="active" />
                        <button
                          type="submit"
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          Approve
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
