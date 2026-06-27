import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { getProfile } from "@/lib/portal";
import {
  trialBalance,
  profitAndLoss,
  balanceSheet,
  type PostedLine,
  type AccountType,
} from "@/lib/accounting";
import { seedChartOfAccounts, postApprovedEntries } from "@/lib/accounting-actions";

export const metadata = { title: "Reports — Mizan Admin" };

function money(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await getProfile();
  if (profile?.role !== "admin") redirect("/app");

  const { id } = await params;
  const { ok, error } = await searchParams;

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!company) notFound();

  // posted journal lines joined with their account, scoped to this company
  const { data: raw } = await supabase
    .from("journal_lines")
    .select("debit, credit, accounts(code,name,type), journal_entries!inner(company_id)")
    .eq("journal_entries.company_id", id);

  const lines: PostedLine[] = (raw ?? [])
    .map((r) => {
      // supabase types embedded relations as array|object depending on inference
      const acc = Array.isArray(r.accounts) ? r.accounts[0] : r.accounts;
      if (!acc) return null;
      return {
        code: acc.code as string,
        name: acc.name as string,
        type: acc.type as AccountType,
        debit: Number(r.debit),
        credit: Number(r.credit),
      };
    })
    .filter((x): x is PostedLine => x !== null);

  const tb = trialBalance(lines);
  const pnl = profitAndLoss(lines);
  const bs = balanceSheet(lines);

  const hasData = lines.length > 0;

  return (
    <PortalShell active="/admin" isAdmin>
      <div className="mx-auto max-w-5xl">
        <Link href={`/admin/${id}`} className="text-sm text-ink-soft hover:text-ink">
          ← {company.name}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Financial statements
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Double-entry statements built from approved ledger lines. Post first, then
          the trial balance, P&amp;L and balance sheet update.
        </p>

        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        {ok && <p className="mt-4 text-sm text-evergreen">{ok}.</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          <form action={seedChartOfAccounts}>
            <input type="hidden" name="company_id" value={company.id} />
            <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">
              Set up chart of accounts
            </button>
          </form>
          <form action={postApprovedEntries}>
            <input type="hidden" name="company_id" value={company.id} />
            <button type="submit" className="btn-primary px-3 py-1.5 text-sm">
              Post approved ledger lines
            </button>
          </form>
          <Link href={`/admin/${id}/ledger`} className="btn-ghost px-3 py-1.5 text-sm">
            Back to ledger
          </Link>
        </div>

        {!hasData ? (
          <div className="card mt-8 text-center">
            <p className="text-sm text-ink-soft">
              No posted entries yet. Approve ledger lines, then{" "}
              <span className="font-medium text-ink">Post approved ledger lines</span>{" "}
              to generate the journals these statements are built from.
            </p>
          </div>
        ) : (
          <>
            {/* Trial Balance */}
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

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              {/* P&L */}
              <section>
                <h2 className="font-display text-xl font-medium">Profit &amp; loss</h2>
                <div className="card mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Income</p>
                  <StatementRows rows={pnl.income} />
                  <div className="mt-1 flex justify-between border-t border-line pt-1 text-sm font-medium">
                    <span>Total income</span><span className="tnum">{money(pnl.totalIncome)}</span>
                  </div>

                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-soft">Expenses</p>
                  <StatementRows rows={pnl.expense} />
                  <div className="mt-1 flex justify-between border-t border-line pt-1 text-sm font-medium">
                    <span>Total expenses</span><span className="tnum">{money(pnl.totalExpense)}</span>
                  </div>

                  <div className="mt-4 flex justify-between border-t-2 border-line pt-2 text-base font-semibold">
                    <span>Net profit</span>
                    <span className={`tnum ${pnl.netProfit < 0 ? "text-danger" : "text-evergreen"}`}>
                      AED {money(pnl.netProfit)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Balance sheet */}
              <section>
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-xl font-medium">Balance sheet</h2>
                  <span className="tnum text-xs text-ink-soft">{bs.balanced ? "✓ balanced" : "⚠ check"}</span>
                </div>
                <div className="card mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Assets</p>
                  <StatementRows rows={bs.assets} />
                  <div className="mt-1 flex justify-between border-t border-line pt-1 text-sm font-medium">
                    <span>Total assets</span><span className="tnum">{money(bs.totalAssets)}</span>
                  </div>

                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-soft">Liabilities</p>
                  <StatementRows rows={bs.liabilities} />
                  <div className="mt-1 flex justify-between border-t border-line pt-1 text-sm font-medium">
                    <span>Total liabilities</span><span className="tnum">{money(bs.totalLiabilities)}</span>
                  </div>

                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-ink-soft">Equity</p>
                  <StatementRows rows={bs.equity} />
                  <div className="mt-1 flex justify-between border-t border-line pt-1 text-sm font-medium">
                    <span>Total equity</span><span className="tnum">{money(bs.totalEquity)}</span>
                  </div>

                  <div className="mt-4 flex justify-between border-t-2 border-line pt-2 text-sm font-semibold">
                    <span>Liabilities + equity</span>
                    <span className="tnum">AED {money(bs.totalLiabilities + bs.totalEquity)}</span>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}

        <p className="mt-8 text-xs text-ink-soft">
          Draft statements for review by a licensed FTA tax agent. Not a substitute for
          formal tax advice or an audit.
        </p>
      </div>
    </PortalShell>
  );
}

function StatementRows({ rows }: { rows: { code: string; name: string; amount: number }[] }) {
  if (rows.length === 0) {
    return <p className="mt-1 text-sm text-ink-soft">—</p>;
  }
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
