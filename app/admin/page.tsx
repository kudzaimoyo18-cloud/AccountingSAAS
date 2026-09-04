import Link from "next/link";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { ApproveButton } from "@/components/admin/ApproveButton";
import { StatusBadge } from "@/components/StatusBadge";
import { desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies as companiesTable, complianceItems } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";

export const metadata = { title: "Admin — Mizan" };

type Row = {
  id: string;
  name: string;
  free_zone: string | null;
  plan: string;
  status: string;
  open: number;
  overdue: boolean | null;
};

function ClientRow({ row, showApprove }: { row: Row; showApprove: boolean }) {
  const open = row.open ?? 0;
  const overdue = Boolean(row.overdue);

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
      <Link
        href={`/admin/${row.id}`}
        className="flex min-h-[44px] min-w-0 flex-1 flex-col justify-center transition-opacity hover:opacity-70"
      >
        <p className="truncate text-sm font-semibold">{row.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">
          {row.free_zone ?? "—"} · {row.plan} · <span className="tnum">{open} open</span>
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={overdue ? "overdue" : row.status} />
        {showApprove && <ApproveButton companyId={row.id} companyName={row.name} />}
      </div>
    </li>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();

  const q = (await searchParams).q?.trim() ?? "";

  // Deliberately cross-tenant: this is the admin client list. The open/overdue
  // counts are aggregated in SQL rather than by pulling every compliance row.
  // The name filter is a bound parameter — the % wildcards are escaped so a
  // search for "100%" does not turn into a match-anything pattern.
  const escaped = q.replace(/[\\%_]/g, (ch) => `\\${ch}`);

  const companies: Row[] = await db
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
    .where(q ? ilike(companiesTable.name, `%${escaped}%`) : undefined)
    .groupBy(companiesTable.id)
    .orderBy(desc(companiesTable.createdAt));

  const pending = companies.filter((c) => c.status !== "active");
  const rest = companies.filter((c) => c.status === "active");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <AdminTabs />

      <header className="space-y-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Clients</h1>
          <p className="tnum mt-1 text-sm text-ink-soft">
            {companies.length} {companies.length === 1 ? "company" : "companies"}
            {q ? ` matching “${q}”` : ""}
          </p>
        </div>

        <form action="/admin" method="GET" role="search" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search clients…"
            aria-label="Search clients by name"
            className="field min-h-[44px] flex-1"
          />
          <button type="submit" className="btn-ghost min-h-[44px] px-4 text-sm">
            Search
          </button>
        </form>
      </header>

      {/* The queue. Everything waiting on you, first — this is the only screen
          in the console with an action on it, so it leads. */}
      <section aria-labelledby="queue-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="queue-heading" className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            Needs approval
          </h2>
          {pending.length > 0 && (
            <span className="tnum text-sm text-ink-soft">{pending.length} waiting</span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-ink-soft">
            Nothing waiting. New sign-ups appear here for approval.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {pending.map((c) => (
              <ClientRow key={c.id} row={c} showApprove />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="active-heading">
        <h2 id="active-heading" className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
          Active clients
        </h2>

        {rest.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            {q ? "No active clients match that search." : "No active clients yet."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {rest.map((c) => (
              <ClientRow key={c.id} row={c} showApprove={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
