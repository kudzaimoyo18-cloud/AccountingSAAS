import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accountingPeriods, companies } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";
import { postedLines } from "@/lib/books/statements";
import { taxFromLines } from "@/lib/tax";
import type { PostedLine, AccountType } from "@/lib/accounting";
import { closePeriod, reopenPeriod } from "@/lib/tax-actions";

export const metadata = { title: "Tax — Mizan Admin" };

function money(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function TaxPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const sp = await searchParams;
  const year = new Date().getUTCFullYear();
  const from = sp.from || `${year}-01-01`;
  const to = sp.to || `${year}-12-31`;

  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) notFound();

  const [lines, periods] = await Promise.all([
    postedLines(id, { from, to }),
    db
      .select({
        id: accountingPeriods.id,
        label: accountingPeriods.label,
        start_date: accountingPeriods.startDate,
        end_date: accountingPeriods.endDate,
        status: accountingPeriods.status,
        vat_output: accountingPeriods.vatOutput,
        vat_input: accountingPeriods.vatInput,
        vat_net: accountingPeriods.vatNet,
        taxable_profit: accountingPeriods.taxableProfit,
        corporate_tax: accountingPeriods.corporateTax,
      })
      .from(accountingPeriods)
      .where(eq(accountingPeriods.companyId, id))
      .orderBy(desc(accountingPeriods.endDate)),
  ]);

  const { vat, ct, netProfit } = taxFromLines(lines);
  const hasData = lines.length > 0;

  return (
    <>
      <div className="mx-auto max-w-4xl">
        <Link href={`/admin/${id}`} className="text-sm text-ink-soft hover:text-ink">← {company.name}</Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">VAT &amp; corporate tax</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Computed from posted journals for the selected period. Closing a period
          snapshots the figures and drafts the filings for agent review.
        </p>

        {sp.error && <p role="alert" className="mt-4 text-sm text-danger">{sp.error}</p>}
        {sp.ok && <p className="mt-4 text-sm text-evergreen">{sp.ok}.</p>}

        {/* Period selector */}
        <form method="get" className="card mt-6 flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-soft">From
            <input type="date" name="from" defaultValue={from} className="field mt-1 block px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-ink-soft">To
            <input type="date" name="to" defaultValue={to} className="field mt-1 block px-2 py-1.5 text-sm" />
          </label>
          <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">Recalculate</button>
        </form>

        {!hasData ? (
          <div className="card mt-6 text-center">
            <p className="text-sm text-ink-soft">No posted journals in this range. Post approved ledger lines on the Statements page first.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {/* VAT */}
            <div className="card">
              <h2 className="font-display text-lg font-medium">VAT return</h2>
              <div className="mt-3 space-y-1 text-sm">
                <Row label="Output VAT (on sales)" value={vat.output} />
                <Row label="Input VAT (on purchases)" value={vat.input} />
                <div className="flex justify-between border-t border-line pt-2 font-semibold">
                  <span>{vat.net >= 0 ? "Net payable to FTA" : "Net refundable"}</span>
                  <span className="tnum">AED {money(Math.abs(vat.net))}</span>
                </div>
              </div>
            </div>

            {/* Corporate tax */}
            <div className="card">
              <h2 className="font-display text-lg font-medium">Corporate tax</h2>
              <div className="mt-3 space-y-1 text-sm">
                <Row label="Taxable profit" value={ct.taxableProfit} />
                <Row label="Less threshold" value={-ct.threshold} />
                <Row label="Taxable above threshold" value={ct.taxable} />
                <div className="flex justify-between border-t border-line pt-2 font-semibold">
                  <span>Corporate tax @ 9%</span>
                  <span className="tnum">AED {money(ct.tax)}</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                Free-zone qualifying income may be taxed at 0% — confirm on review.
              </p>
            </div>
          </div>
        )}

        {/* Close period */}
        {hasData && (
          <form action={closePeriod} className="card mt-6">
            <input type="hidden" name="company_id" value={company.id} />
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-ink-soft">Period label
                <input name="label" required placeholder="Q2 2026" defaultValue="" className="field mt-1 block px-2 py-1.5 text-sm" />
              </label>
              <button type="submit" className="btn-primary px-3 py-1.5 text-sm">Close period &amp; draft filings</button>
              <span className="text-xs text-ink-soft">
                Net profit {money(netProfit)} · VAT {money(vat.net)} · CT {money(ct.tax)}
              </span>
            </div>
          </form>
        )}

        {/* Closed periods */}
        <h2 className="mt-10 font-display text-xl font-medium">Closed periods</h2>
        {(periods ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">None yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="px-4 py-2 font-medium">Period</th>
                  <th className="px-4 py-2 font-medium">Range</th>
                  <th className="px-4 py-2 text-right font-medium">VAT net</th>
                  <th className="px-4 py-2 text-right font-medium">Corporate tax</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(periods ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">{p.label}</td>
                    <td className="tnum px-4 py-2 text-ink-soft">{p.start_date} → {p.end_date}</td>
                    <td className="tnum px-4 py-2 text-right">{money(Number(p.vat_net))}</td>
                    <td className="tnum px-4 py-2 text-right">{money(Number(p.corporate_tax))}</td>
                    <td className="px-4 py-2 text-right">
                      <form action={reopenPeriod}>
                        <input type="hidden" name="company_id" value={company.id} />
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="text-xs text-ink-soft hover:text-ink">Reopen</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-8 text-xs text-ink-soft">
          Auto-computed drafts for review by a licensed FTA tax agent. Not a substitute
          for formal tax advice.
        </p>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="tnum">{money(value)}</span>
    </div>
  );
}
