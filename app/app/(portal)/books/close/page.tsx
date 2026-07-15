import Link from "next/link";
import { redirect } from "next/navigation";
import { BooksTabs } from "@/components/books/BooksTabs";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany } from "@/lib/books/repo";
import { loadSummary } from "@/lib/books/summary";
import { generateTaxPack, inviteAgent, revokeAgent } from "@/lib/books/handoff";
import { money, longDate } from "@/lib/demo/format";
import { REGIONS } from "@/lib/demo/regions";

export const metadata = { title: "Close & hand off — Mizan Books" };

interface PackRow {
  id: string;
  period_label: string;
  status: string;
  created_at: string;
  totals: { netProfit?: number; vatDue?: number } | null;
}
interface MemberRow {
  id: string;
  invited_email: string;
  role: string;
  status: string;
}

export default async function ClosePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { reports } = await loadSummary(company);
  const cfg = REGIONS[company.region];

  const [{ data: packs }, { data: members }] = await Promise.all([
    supabase
      .from("tax_packs")
      .select("id, period_label, status, created_at, totals")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("company_members")
      .select("id, invited_email, role, status")
      .eq("company_id", company.id)
      .neq("status", "revoked")
      .order("created_at", { ascending: false }),
  ]);

  const period =
    reports.periodStart && reports.periodEnd
      ? `${longDate(reports.periodStart, company.region)} – ${longDate(reports.periodEnd, company.region)}`
      : "No posted transactions yet";

  return (
    <div className="mx-auto max-w-5xl">
        <BooksTabs active="close" reviewCount={reports.reviewCount} />
        <p className="mt-4 text-sm text-ink-soft">{period}</p>

        {ok && (
          <p className="alert-banner alert-banner-positive mt-4">
            {decodeURIComponent(ok.replace(/\+/g, " "))}
          </p>
        )}
        {error && (
          <p role="alert" className="alert-banner alert-banner-danger mt-4">
            {error.replace(/\+/g, " ")}
          </p>
        )}

        {reports.reviewCount > 0 && (
          <p className="alert-banner alert-banner-warning mt-4">
            {reports.reviewCount} transaction{reports.reviewCount === 1 ? "" : "s"} still need review — clear the
            queue first so the pack is complete.
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* The pack */}
          <div className="card">
            <h2 className="font-display text-lg font-semibold">Accounts pack</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Filing-ready P&amp;L, {cfg.vatReturnName}, and full ledger — ready for your tax agent.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Net profit" value={money(reports.netProfit, company.region)} />
              <Stat label={`${cfg.vatLabel} due`} value={money(reports.vatDue, company.region)} />
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href="/app/books/pack" className="btn-primary">Download Excel pack</a>
              <Link href="/app/reports/print" className="btn-ghost">Print / PDF</Link>
            </div>
            <form action={generateTaxPack} className="mt-3">
              <button type="submit" className="text-sm font-medium text-evergreen-deep hover:underline">
                Mark this period as closed →
              </button>
            </form>
          </div>

          {/* Tax agent access */}
          <div className="card">
            <h2 className="font-display text-lg font-semibold">Give your tax agent access</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Invite your accountant or tax agent by email. They get read-only access to these books once they
              sign in.
            </p>
            <form action={inviteAgent} className="mt-4 flex flex-wrap gap-2">
              <input
                type="email"
                name="email"
                required
                placeholder="agent@firm.com"
                className="field flex-1 min-w-[12rem]"
              />
              <select name="role" defaultValue="tax_agent" className="field w-auto">
                <option value="tax_agent">Tax agent</option>
                <option value="accountant">Accountant</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" className="btn-primary">Invite</button>
            </form>

            {members && members.length > 0 && (
              <ul className="mt-4 divide-y divide-line">
                {(members as MemberRow[]).map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>
                      <span className="font-medium">{m.invited_email}</span>
                      <span className="ml-2 text-xs text-ink-soft">{m.role.replace("_", " ")} · {m.status}</span>
                    </span>
                    <form action={revokeAgent}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="text-xs text-ink-soft hover:text-danger">Revoke</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-soft">
              Email delivery of invites is coming soon — for now, share the sign-in link with them directly.
            </p>
          </div>
        </div>

        {/* Closed periods */}
        {packs && packs.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-xl font-medium">Closed periods</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 text-right font-medium">Net profit</th>
                    <th className="px-4 py-3 text-right font-medium">VAT due</th>
                    <th className="px-4 py-3 font-medium">Closed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(packs as PackRow[]).map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium">{p.period_label}</td>
                      <td className="tnum px-4 py-3 text-right">
                        {p.totals?.netProfit != null ? money(p.totals.netProfit, company.region) : "—"}
                      </td>
                      <td className="tnum px-4 py-3 text-right">
                        {p.totals?.vatDue != null ? money(p.totals.vatDue, company.region) : "—"}
                      </td>
                      <td className="tnum px-4 py-3 text-ink-soft">{longDate(p.created_at, company.region)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper-dim px-3 py-2.5">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="tnum mt-0.5 font-display text-lg font-semibold">{value}</dd>
    </div>
  );
}
