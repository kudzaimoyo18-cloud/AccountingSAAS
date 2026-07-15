import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCompany } from "@/lib/books/repo";
import { loadStatements } from "@/lib/books/statements";
import { CT_THRESHOLD } from "@/lib/tax";
import { MobileInsights, type InsightKpi } from "@/components/app/mobile/MobileInsights";

export const metadata = { title: "Reports — Mizan" };

// Financial figures must always be live — never serve a cached render, so a
// newly approved ledger line shows up in the statements immediately.
export const dynamic = "force-dynamic";

function money(n: number) {
  return n.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function ReportsPage() {
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const { tb, pnl, bs, tax, hasData } = await loadStatements(company.id);

  // Mobile Insights: KPI grid + expense breakdown from the same statements.
  const insightKpis: InsightKpi[] = [
    { label: "Revenue", value: `AED ${money(pnl.totalIncome)}` },
    { label: "Expenses", value: `AED ${money(pnl.totalExpense)}` },
    { label: "Net profit", value: `AED ${money(pnl.netProfit)}`, tone: pnl.netProfit < 0 ? "danger" : "positive" },
    { label: "VAT due", value: `AED ${money(tax.vat.net)}` },
  ];
  const totalExp = pnl.totalExpense || 1;
  const insightCats = [...pnl.expense]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((e) => ({ name: e.name, pct: Math.round((e.amount / totalExp) * 100) }));

  return (
    <>
    {/* mobile Insights (Cash Now) */}
    <div className="md:hidden">
      <MobileInsights
        kpis={insightKpis}
        cats={insightCats}
        vatDue={hasData ? tax.vat.net : 0}
        currency="AED"
        hasData={hasData}
      />
    </div>

    {/* desktop reports */}
    <div className="mx-auto hidden max-w-6xl md:block">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <p className="text-sm text-ink-soft">
          Built from your approved ledger lines (cash basis). Approve a line and
          it lands here automatically.
        </p>
        <Link href="/app/reports/print" className="btn-ghost btn-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4 6V2h8v4M4 12H2V6h12v6h-2M4 10h8v4H4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Print / PDF
        </Link>
      </div>

      {!hasData ? (
        <div className="card mt-8 text-center">
          <p className="font-display text-lg font-medium">No posted figures yet</p>
          <p className="mt-2 text-sm text-ink-soft">
            Upload an invoice or receipt, let Mizan draft the ledger, then{" "}
            <span className="font-medium text-ink">approve</span> each line — your
            profit &amp; loss, balance sheet, VAT and tax build here automatically.
          </p>
          <Link href="/app/books/ledger" className="btn-primary mt-4 inline-block">
            Go to the ledger
          </Link>
        </div>
      ) : (
        <>
          {/* Headline figures */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-kpis>
            <Kpi label="Revenue" value={money(pnl.totalIncome)} />
            <Kpi label="Expenses" value={money(pnl.totalExpense)} />
            <Kpi
              label="Net profit"
              value={money(pnl.netProfit)}
              tone={pnl.netProfit < 0 ? "danger" : "evergreen"}
            />
            <Kpi label="VAT due (5%)" value={money(tax.vat.net)} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* P&L */}
            <section className="card">
              <h2 className="font-display text-lg font-semibold">Profit &amp; loss</h2>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Income
              </p>
              <Rows rows={pnl.income} />
              <Subtotal label="Total income" value={money(pnl.totalIncome)} />
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Expenses
              </p>
              <Rows rows={pnl.expense} />
              <Subtotal label="Total expenses" value={money(pnl.totalExpense)} />
              <div className="mt-4 flex items-center justify-between border-t-2 border-ink/20 pt-3">
                <span className="font-display text-base font-semibold">Net profit</span>
                <span
                  className={`tnum font-display text-xl font-semibold ${
                    pnl.netProfit < 0 ? "text-danger" : "text-evergreen"
                  }`}
                >
                  AED {money(pnl.netProfit)}
                </span>
              </div>
            </section>

            {/* Balance sheet + tax */}
            <div className="space-y-6">
              <section className="card">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-semibold">Balance sheet</h2>
                  <span className="tnum text-xs text-ink-soft">
                    {bs.balanced ? "✓ balanced" : "⚠ check"}
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Assets
                </p>
                <Rows rows={bs.assets} />
                <Subtotal label="Total assets" value={money(bs.totalAssets)} />
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Liabilities
                </p>
                <Rows rows={bs.liabilities} />
                <Subtotal label="Total liabilities" value={money(bs.totalLiabilities)} />
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Equity
                </p>
                <Rows rows={bs.equity} />
                <Subtotal label="Total equity" value={money(bs.totalEquity)} />
              </section>

              {/* VAT */}
              <section className="card">
                <h2 className="font-display text-lg font-semibold">VAT return (5%)</h2>
                <div className="mt-3 space-y-1">
                  <Line label="Output VAT (on sales)" value={money(tax.vat.output)} />
                  <Line label="Input VAT (on purchases)" value={`−${money(tax.vat.input)}`} />
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-paper-dim px-4 py-3">
                  <span className="font-medium">Net VAT due to the FTA</span>
                  <span className="tnum font-display text-lg font-semibold">
                    {money(tax.vat.net)}
                  </span>
                </div>
              </section>

              {/* Corporate tax */}
              <section className="card">
                <h2 className="font-display text-lg font-semibold">Corporate tax (9%)</h2>
                <div className="mt-3 space-y-1">
                  <Line label="Taxable profit" value={money(tax.ct.taxableProfit)} />
                  <Line label="0% band" value={money(CT_THRESHOLD)} />
                  <Subtotal
                    label="Estimated tax (set aside)"
                    value={money(tax.ct.tax)}
                  />
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  9% on profit above AED 375,000 (Federal Decree-Law 47). Free-zone
                  qualifying income may be 0% — confirm with your tax agent.
                </p>
              </section>
            </div>
          </div>

          {/* Trial balance */}
          <section className="panel mt-8">
            <div className="panel-header">
              <p className="panel-title">Trial balance</p>
              <span className={`badge ${tb.totalDebit === tb.totalCredit ? "badge-positive" : "badge-danger"}`}>
                {tb.totalDebit === tb.totalCredit ? "Balanced" : "Out of balance"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((r) => (
                    <tr key={r.code}>
                      <td className="tnum text-ink-soft">{r.code}</td>
                      <td>{r.name}</td>
                      <td className="num">{r.debit ? money(r.debit) : "—"}</td>
                      <td className="num">{r.credit ? money(r.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="px-4 py-2.5" colSpan={2}>Total</td>
                    <td className="tnum px-4 py-2.5 text-right">{money(tb.totalDebit)}</td>
                    <td className="tnum px-4 py-2.5 text-right">{money(tb.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="mt-8 text-xs text-ink-soft">
        Draft statements for your review. Mizan is bookkeeping software, not a
        substitute for a licensed FTA tax agent — have your figures reviewed before
        filing.
      </p>
    </div>
    </>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "evergreen" | "danger";
}) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p
        className={`kpi-value ${
          tone === "evergreen" ? "text-evergreen" : tone === "danger" ? "text-danger" : "text-ink"
        }`}
      >
        AED {value}
      </p>
    </div>
  );
}

function Rows({ rows }: { rows: { code: string; name: string; amount: number }[] }) {
  if (rows.length === 0) return <p className="mt-1 text-sm text-ink-soft">—</p>;
  return (
    <div className="mt-1 space-y-0.5">
      {rows.map((r) => (
        <div key={r.code} className="flex justify-between text-sm">
          <span className="text-ink-soft">{r.name}</span>
          <span className="tnum">{money(r.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="tnum text-ink">{value}</span>
    </div>
  );
}

function Subtotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex items-center justify-between border-t border-line pt-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <span className="tnum font-semibold">{value}</span>
    </div>
  );
}
