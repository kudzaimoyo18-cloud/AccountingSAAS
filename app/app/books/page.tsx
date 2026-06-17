import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { BooksTabs } from "@/components/books/BooksTabs";
import { CategoryBadge, StatusPill } from "@/components/books/ui";
import { getProfile } from "@/lib/portal";
import { getActiveCompany, listTransactions } from "@/lib/books/repo";
import { buildReports } from "@/lib/books/reports";
import { addTransaction } from "@/lib/books/actions";
import { money, shortDate } from "@/lib/demo/format";
import { selectableAccounts } from "@/lib/demo/coa";
import { REGIONS } from "@/lib/demo/regions";

export const metadata = { title: "Books — Mizan" };

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; review?: string; imported?: string; auto?: string }>;
}) {
  const { profile } = await getProfile();
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const { ok, error, imported, auto } = await searchParams;
  const txns = await listTransactions(company.id);
  const reports = buildReports(txns, company.region);
  const cfg = REGIONS[company.region];
  const accounts = selectableAccounts(company.region);
  const recent = txns.slice(0, 12);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PortalShell active="/app/books" isAdmin={profile?.role === "admin"}>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{cfg.flag} {cfg.label} · {cfg.filingAuthority}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{company.name}</h1>
          </div>
          <Link href="/app/books/import" className="btn-primary">Import statement</Link>
        </div>

        <div className="mt-6">
          <BooksTabs active="overview" reviewCount={reports.reviewCount} />
        </div>

        {ok && (
          <p className="mt-4 rounded-xl border border-evergreen/30 bg-evergreen/10 px-4 py-2.5 text-sm text-evergreen">
            {ok.replace(/\+/g, " ")}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error.replace(/\+/g, " ")}
          </p>
        )}

        {imported && (
          <ImportResult total={Number(imported)} auto={Number(auto ?? 0)} review={reports.reviewCount} />
        )}

        {!imported && reports.reviewCount > 0 && (
          <Link
            href="/app/books/review"
            className="mt-4 flex items-center justify-between rounded-2xl border border-brass/40 bg-brass/5 px-5 py-3.5 transition-colors hover:bg-brass/10"
          >
            <span className="text-sm">
              <span className="font-semibold text-brass-deep">{reports.reviewCount}</span> transaction
              {reports.reviewCount === 1 ? "" : "s"} need a quick review before they hit your books.
            </span>
            <span className="text-sm font-medium text-brass-deep">Review →</span>
          </Link>
        )}

        {/* KPI cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Money in" value={money(reports.moneyIn, company.region)} tone="evergreen" />
          <Kpi label="Money out" value={money(reports.moneyOut, company.region)} />
          <Kpi label="Net profit" value={money(reports.netProfit, company.region)} tone="evergreen" />
          <Kpi label={`${cfg.vatLabel} due`} value={money(reports.vatDue, company.region)} />
        </div>

        {/* Add transaction (collapsible) */}
        <details className="card mt-6 [&_summary]:cursor-pointer">
          <summary className="font-display text-base font-semibold">+ Add income or expense manually</summary>
          <form action={addTransaction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="date" className="mb-1 block text-xs font-medium text-ink-soft">Date</label>
              <input id="date" name="date" type="date" required defaultValue={today} className="field" />
            </div>
            <div>
              <label htmlFor="direction" className="mb-1 block text-xs font-medium text-ink-soft">Type</label>
              <select id="direction" name="direction" className="field" defaultValue="out">
                <option value="out">Expense (money out)</option>
                <option value="in">Income (money in)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description" className="mb-1 block text-xs font-medium text-ink-soft">Description</label>
              <input id="description" name="description" required maxLength={300} placeholder="e.g. Gulf Mart — office supplies" className="field" />
            </div>
            <div>
              <label htmlFor="counterparty" className="mb-1 block text-xs font-medium text-ink-soft">Payee / source <span className="opacity-60">(optional)</span></label>
              <input id="counterparty" name="counterparty" maxLength={200} className="field" />
            </div>
            <div>
              <label htmlFor="amount" className="mb-1 block text-xs font-medium text-ink-soft">Amount ({cfg.currency}, gross)</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0" required className="field tnum" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">Categorise &amp; add</button>
              <span className="ml-3 text-xs text-ink-soft">Mizan picks the account and splits VAT automatically.</span>
            </div>
          </form>
        </details>

        {/* Recent transactions */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-display text-xl font-medium">Transactions</h2>
          <span className="text-sm text-ink-soft">{reports.postedCount} posted · {reports.totalCount} total</span>
        </div>

        {txns.length === 0 ? (
          <div className="card mt-4 text-center">
            <p className="font-display text-lg font-medium">No transactions yet</p>
            <p className="mt-2 text-sm text-ink-soft">
              Import a bank statement (CSV) or add an entry above to get started.
            </p>
            <Link href="/app/books/import" className="btn-primary mt-4 inline-block">Import a statement</Link>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td className="tnum whitespace-nowrap px-4 py-3 text-ink-soft">{shortDate(t.date, company.region)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{t.description}</span>
                      {t.counterparty && <span className="block text-xs text-ink-soft">{t.counterparty}</span>}
                    </td>
                    <td className="px-4 py-3"><CategoryBadge category={t.category} code={t.accountCode} /></td>
                    <td className={`tnum whitespace-nowrap px-4 py-3 text-right font-medium ${t.direction === "in" ? "text-evergreen" : "text-ink"}`}>
                      {t.direction === "in" ? "+" : "−"}{money(t.amount, company.region)}
                    </td>
                    <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "evergreen" }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className={`tnum mt-2 font-display text-2xl font-semibold ${tone === "evergreen" ? "text-evergreen" : ""}`}>{value}</p>
    </div>
  );
}

/** Post-import payoff: shows the "AI did the work, you check the rest" split. */
function ImportResult({ total, auto, review }: { total: number; auto: number; review: number }) {
  const safeTotal = Math.max(total, 1);
  const pct = Math.round((auto / safeTotal) * 100);
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-evergreen/30 bg-evergreen/5">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">
            Imported {total} transaction{total === 1 ? "" : "s"} — Mizan did {pct}% for you.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            <span className="font-medium text-evergreen">{auto} auto-categorised by AI</span>
            {review > 0 ? (
              <>
                {" "}· <span className="font-medium text-brass-deep">{review} flagged for your quick review</span>
              </>
            ) : (
              <> · nothing needs your review</>
            )}
          </p>
        </div>
        {review > 0 ? (
          <Link href="/app/books/review" className="btn-primary whitespace-nowrap">
            Review {review} →
          </Link>
        ) : (
          <Link href="/app/books/reports" className="btn-primary whitespace-nowrap">
            See reports →
          </Link>
        )}
      </div>
      {/* visual 90/10 split: evergreen = AI auto-posted, brass = needs you */}
      <div className="flex h-1.5 w-full" aria-hidden>
        <div className="bg-evergreen" style={{ width: `${pct}%` }} />
        <div className="bg-brass" style={{ width: `${100 - pct}%` }} />
      </div>
    </div>
  );
}
