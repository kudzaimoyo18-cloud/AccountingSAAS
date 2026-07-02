import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCompany, listTransactions } from "@/lib/books/repo";
import { buildReports } from "@/lib/books/reports";
import { money, longDate } from "@/lib/demo/format";
import { REGIONS } from "@/lib/demo/regions";

export const metadata = { title: "Reports — Mizan Books" };

export default async function ReportsPage() {
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const txns = await listTransactions(company.id);
  const reports = buildReports(txns, company.region);
  const cfg = REGIONS[company.region];
  const period =
    reports.periodStart && reports.periodEnd
      ? `${longDate(reports.periodStart, company.region)} – ${longDate(reports.periodEnd, company.region)}`
      : "No posted transactions yet";

  return (
    <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Filing-ready · {cfg.filingAuthority}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Reports</h1>
            <p className="mt-1 text-sm text-ink-soft">{period}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/reports/print" className="btn-ghost">Print / PDF</Link>
            <Link href="/app/books/close" className="btn-primary">Close &amp; hand off</Link>
          </div>
        </div>

        {reports.reviewCount > 0 && (
          <p className="mt-4 rounded-xl border border-brass/30 bg-brass/5 px-4 py-2.5 text-sm text-brass-deep">
            {reports.reviewCount} transaction{reports.reviewCount === 1 ? "" : "s"} still in review — these
            are excluded from the figures below until you approve them.
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* P&L */}
          <div className="card">
            <h2 className="font-display text-lg font-semibold">Profit &amp; loss</h2>
            <Section title="Income" />
            {reports.incomeLines.length === 0 && <Empty />}
            {reports.incomeLines.map((l) => (
              <Line key={l.code} label={l.name} value={money(l.amount, company.region)} />
            ))}
            <Subtotal label="Total revenue" value={money(reports.revenue, company.region)} />

            <Section title="Expenses" />
            {reports.expenseLines.length === 0 && <Empty />}
            {reports.expenseLines.map((l) => (
              <Line key={l.code} label={l.name} value={`−${money(l.amount, company.region)}`} />
            ))}
            <Subtotal label="Total expenses" value={`−${money(reports.totalExpenses, company.region)}`} />

            <div className="mt-4 flex items-center justify-between border-t-2 border-ink/20 pt-4">
              <span className="font-display text-base font-semibold">Net profit</span>
              <span className="tnum font-display text-xl font-semibold text-evergreen">
                {money(reports.netProfit, company.region)}
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {/* VAT */}
            <div className="card">
              <h2 className="font-display text-lg font-semibold">{cfg.vatReturnName}</h2>
              <p className="text-xs text-ink-soft">{cfg.vatLabel}</p>
              <div className="mt-4 space-y-1">
                <Line label="VAT on sales (output)" value={money(reports.outputVat, company.region)} />
                <Line label="VAT on purchases (input)" value={`−${money(reports.inputVat, company.region)}`} />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-paper-dim px-4 py-3">
                <span className="font-medium">Net VAT due</span>
                <span className="tnum font-display text-lg font-semibold">{money(reports.vatDue, company.region)}</span>
              </div>
            </div>

            {/* Balance snapshot */}
            <div className="card">
              <h2 className="font-display text-lg font-semibold">Balance snapshot</h2>
              <div className="mt-4 space-y-1">
                <Line label="Net cash movement" value={money(reports.cashBalance, company.region)} />
                <Line label="VAT control" value={`−${money(reports.vatLiability, company.region)}`} />
                <Subtotal label="Retained profit" value={money(reports.equity, company.region)} />
              </div>
            </div>

            {/* Tax */}
            <div className="card">
              <h2 className="font-display text-lg font-semibold">{cfg.taxName}</h2>
              <div className="mt-3 space-y-1">
                <Line label="Projected annual profit" value={money(reports.annualProjectedProfit, company.region)} />
                <Line label="0% band" value={money(cfg.taxFreeThreshold, company.region)} />
                <Subtotal
                  label="Estimated tax (set aside)"
                  value={reports.withinFreeBand ? money(0, company.region) : money(reports.taxSetAside, company.region)}
                />
              </div>
              <p className="mt-2 text-xs text-ink-soft">{cfg.taxNote}</p>
            </div>
          </div>
        </div>
      </div>
  );
}

function Section({ title }: { title: string }) {
  return <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-brass-deep">{title}</p>;
}
function Empty() {
  return <p className="py-1.5 text-sm text-ink-soft">—</p>;
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="tnum text-ink">{value}</span>
    </div>
  );
}
function Subtotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex items-center justify-between border-t border-line pt-2 text-sm">
      <span className="font-medium">{label}</span>
      <span className="tnum font-semibold">{value}</span>
    </div>
  );
}
