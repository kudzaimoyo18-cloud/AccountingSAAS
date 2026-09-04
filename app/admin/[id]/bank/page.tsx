import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankTransactions, companies, journalEntries, journalLines } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";
import {
  importBankCsv,
  autoReconcile,
  matchTransaction,
  unmatchTransaction,
} from "@/lib/bank-actions";

export const metadata = { title: "Bank — Mizan Admin" };

function money(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function BankPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const { ok, error } = await searchParams;

  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) notFound();

  const [txns, entries, lines] = await Promise.all([
    db
      .select({
        id: bankTransactions.id,
        txn_date: bankTransactions.txnDate,
        description: bankTransactions.description,
        amount: bankTransactions.amount,
        currency: bankTransactions.currency,
        matched_entry_id: bankTransactions.matchedEntryId,
        status: bankTransactions.status,
      })
      .from(bankTransactions)
      .where(eq(bankTransactions.companyId, id))
      .orderBy(desc(bankTransactions.txnDate)),
    db
      .select({
        id: journalEntries.id,
        entry_date: journalEntries.entryDate,
        memo: journalEntries.memo,
      })
      .from(journalEntries)
      .where(eq(journalEntries.companyId, id))
      .orderBy(desc(journalEntries.entryDate)),
    // journal_lines has no company_id — the join to its parent entry is what
    // scopes it.
    db
      .select({ entry_id: journalLines.entryId, debit: journalLines.debit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(eq(journalEntries.companyId, id)),
  ]);

  const gross = new Map<string, number>();
  for (const l of lines) gross.set(l.entry_id, (gross.get(l.entry_id) ?? 0) + Number(l.debit));

  const matchedIds = new Set(txns.map((t) => t.matched_entry_id).filter(Boolean));
  const candidates = entries
    .filter((e) => !matchedIds.has(e.id))
    .map((e) => ({
      id: e.id,
      label: `${e.entry_date ?? "—"} · ${e.memo || "entry"} · AED ${money(gross.get(e.id) ?? 0)}`,
    }));

  const rows = txns;
  const unmatched = rows.filter((t) => t.status === "unmatched").length;
  const matched = rows.filter((t) => t.status === "matched").length;

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <Link href={`/admin/${id}`} className="text-sm text-ink-soft hover:text-ink">← {company.name}</Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Bank reconciliation</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Import bank lines and match them to recorded journal entries, so the books
          agree with the bank.
        </p>

        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        {ok && <p className="mt-4 text-sm text-evergreen">{ok}.</p>}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="card"><p className="text-xs text-ink-soft">Imported</p><p className="tnum mt-1 text-xl font-semibold">{rows.length}</p></div>
          <div className="card"><p className="text-xs text-ink-soft">Matched</p><p className="tnum mt-1 text-xl font-semibold text-evergreen">{matched}</p></div>
          <div className="card"><p className="text-xs text-ink-soft">Unmatched</p><p className="tnum mt-1 text-xl font-semibold">{unmatched}</p></div>
        </div>

        {/* Import */}
        <h2 className="mt-10 font-display text-xl font-medium">Import statement (CSV)</h2>
        <form action={importBankCsv} className="card mt-4">
          <input type="hidden" name="company_id" value={company.id} />
          <textarea
            name="csv"
            rows={5}
            required
            placeholder={"2026-05-12, DEWA May invoice, -1302.00\n2026-05-18, Acme retainer, 18900.00"}
            className="field w-full font-mono text-xs"
            aria-label="Bank CSV"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-ink-soft">One row per line: <span className="tnum">date, description, amount</span> (money out negative).</p>
            <button type="submit" className="btn-primary px-3 py-1.5 text-sm">Import</button>
          </div>
        </form>

        {/* Reconcile */}
        <div className="mt-6">
          <form action={autoReconcile}>
            <input type="hidden" name="company_id" value={company.id} />
            <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">Auto-match by amount &amp; date</button>
          </form>
        </div>

        <h2 className="mt-10 font-display text-xl font-medium">Bank lines</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Nothing imported yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.description || "—"}</p>
                  <p className="tnum mt-0.5 text-xs text-ink-soft">
                    {t.txn_date} · <span className={Number(t.amount) < 0 ? "text-danger" : "text-evergreen"}>AED {money(Number(t.amount))}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.status === "matched" ? "approved" : "draft"} />
                  {t.status === "matched" ? (
                    <form action={unmatchTransaction}>
                      <input type="hidden" name="company_id" value={company.id} />
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="text-xs text-ink-soft hover:text-ink">Unmatch</button>
                    </form>
                  ) : (
                    <form action={matchTransaction} className="flex items-center gap-1">
                      <input type="hidden" name="company_id" value={company.id} />
                      <input type="hidden" name="id" value={t.id} />
                      <select name="entry_id" required defaultValue="" className="field w-64 px-2 py-1 text-xs" aria-label="Match to entry">
                        <option value="" disabled>Match to entry…</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      <button type="submit" className="btn-ghost px-2.5 py-1 text-xs">Match</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-xs text-ink-soft">
          Reconciliation is a draft control for review by a licensed FTA tax agent.
        </p>
      </div>
    </>
  );
}
