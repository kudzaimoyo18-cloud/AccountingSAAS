import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCompany } from "@/lib/books/repo";
import { loadStatements } from "@/lib/books/statements";
import { CT_THRESHOLD } from "@/lib/tax";

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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Filing-ready · double-entry</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Reports
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Built from your approved ledger lines (cash basis). Approve a line and
            it lands here automatically.
          </p>
        </div>
        <Link href="/app/reports/print" className="btn-ghost">
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
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brass-deep">
                Income
              </p>
              <Rows rows={pnl.income} />
              <Subtotal label="Total income" value={money(pnl.totalIncome)} />
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brass-deep">
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
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brass-deep">
                  Assets
                </p>
                <Rows rows={bs.assets} />
                <Subtotal label="Total assets" value={money(bs.totalAssets)} />
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brass-deep">
                  Liabilities
                </p>
                <Rows rows={bs.liabilities} />
                <Subtotal label="Total liabilities" value={money(bs.totalLiabilities)} />
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brass-deep">
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
          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-medium">Trial balance</h2>
              <span className="tnum text-xs text-ink-soft">
                {tb.totalDebit === tb.totalCredit ? "✓ balanced" : "⚠ out of balance"}
              </span>
            </div>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-soft">
                    <th className="px-4 py-2 font-medium">Code</th>
                    <th className="px-4 py-2 font-medium">Account</th>
                    <th className="px-4 py-2 text-right font-medium">Debit</th>
                    <th className="px-4 py-2 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {tb.rows.map((r) => (
                    <tr key={r.code}>
                      <td className="tnum px-4 py-2 text-ink-soft">{r.code}</td>
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="tnum px-4 py-2 text-right">{r.debit ? money(r.debit) : "—"}</td>
                      <td className="tnum px-4 py-2 text-right">{r.credit ? money(r.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line font-medium">
                    <td className="px-4 py-2" colSpan={2}>Total</td>
                    <td className="tnum px-4 py-2 text-right">{money(tb.totalDebit)}</td>
                    <td className="tnum px-4 py-2 text-right">{money(tb.totalCredit)}</td>
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
    <div className="card">
      <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p
        className={`tnum mt-2 font-display text-2xl font-semibold ${
          tone === "evergreen" ? "text-evergreen" : tone === "danger" ? "text-danger" : ""
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
