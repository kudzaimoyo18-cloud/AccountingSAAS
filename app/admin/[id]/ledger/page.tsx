import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, documents, ledgerEntries } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";
import { ledgerColumns } from "@/lib/books/ledger-query";
import { LEDGER_CATEGORIES } from "@/lib/ai";
import {
  extractDocument,
  updateLedgerEntry,
  setLedgerStatus,
  addLedgerEntry,
  deleteLedgerEntry,
} from "@/lib/ledger-actions";

export const metadata = { title: "Ledger — Mizan Admin" };

const DIRECTIONS = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

function catLabel(c: string) {
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function money(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function LedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const { error, ok } = await searchParams;

  const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!company) notFound();

  const [entries, docs] = await Promise.all([
    db
      .select({ ...ledgerColumns, created_at: ledgerEntries.createdAt })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.companyId, id))
      .orderBy(sql`${ledgerEntries.entryDate} asc nulls last`, asc(ledgerEntries.createdAt)),
    db
      .select({
        id: documents.id,
        original_name: documents.originalName,
        kind: documents.kind,
        status: documents.status,
        created_at: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.companyId, id))
      .orderBy(desc(documents.createdAt)),
  ]);

  const rows = entries;
  const income = rows.filter((r) => r.direction === "income");
  const expense = rows.filter((r) => r.direction === "expense");
  const sum = (arr: typeof rows, key: "amount" | "vat_amount") =>
    arr.reduce((t, r) => t + Number(r[key] ?? 0), 0);

  const totalIncome = sum(income, "amount");
  const totalExpense = sum(expense, "amount");
  const net = totalIncome - totalExpense;
  const vatCollected = sum(income, "vat_amount");
  const vatPaid = sum(expense, "vat_amount");

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <Link href={`/admin/${id}`} className="text-sm text-ink-soft hover:text-ink">
          ← {company.name}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          AI ledger
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Claude drafts the books from uploaded documents. Every column is editable —
          correct anything before you mark a line reviewed or approved.
        </p>

        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        {ok && <p className="mt-4 text-sm text-evergreen">{ok}.</p>}

        {/* Totals */}
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Income (net)", value: totalIncome },
            { label: "Expense (net)", value: totalExpense },
            { label: "Net", value: net },
            { label: "VAT (out − in)", value: vatCollected - vatPaid },
          ].map((c) => (
            <div key={c.label} className="card">
              <p className="text-xs text-ink-soft">{c.label}</p>
              <p className="tnum mt-1 text-xl font-semibold">AED {money(c.value)}</p>
            </div>
          ))}
        </div>

        {/* Run AI extraction on a document */}
        <h2 className="mt-10 font-display text-xl font-medium">Extract from a document</h2>
        {(docs ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            No documents uploaded yet. Ask the client to upload invoices or statements.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.original_name}</p>
                  <p className="tnum mt-0.5 text-xs text-ink-soft">
                    {d.kind} · {new Date(d.created_at).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <form action={extractDocument}>
                  <input type="hidden" name="document_id" value={d.id} />
                  <input type="hidden" name="company_id" value={company.id} />
                  <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
                    Extract with AI
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {/* Editable ledger */}
        <h2 className="mt-10 font-display text-xl font-medium">Ledger lines</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            No lines yet. Run an extraction above, or add one by hand below.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Counterparty</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Dir.</th>
                  <th className="px-3 py-2 font-medium">Net</th>
                  <th className="px-3 py-2 font-medium">VAT</th>
                  <th className="px-3 py-2 font-medium">Cur.</th>
                  <th className="px-3 py-2 font-medium">AI</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-2 py-2" colSpan={10}>
                      <form
                        action={updateLedgerEntry}
                        className="grid grid-cols-[110px_1.4fr_1fr_140px_92px_92px_92px_64px_auto] items-center gap-2"
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="company_id" value={company.id} />
                        <input
                          type="date"
                          name="entry_date"
                          defaultValue={r.entry_date ?? ""}
                          className="field px-2 py-1 text-xs"
                          aria-label="Date"
                        />
                        <input
                          name="description"
                          defaultValue={r.description ?? ""}
                          className="field px-2 py-1 text-xs"
                          aria-label="Description"
                        />
                        <input
                          name="counterparty"
                          defaultValue={r.counterparty ?? ""}
                          className="field px-2 py-1 text-xs"
                          aria-label="Counterparty"
                        />
                        <select
                          name="category"
                          defaultValue={r.category}
                          className="field px-2 py-1 text-xs"
                          aria-label="Category"
                        >
                          {LEDGER_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{catLabel(c)}</option>
                          ))}
                        </select>
                        <select
                          name="direction"
                          defaultValue={r.direction}
                          className="field px-2 py-1 text-xs"
                          aria-label="Direction"
                        >
                          {DIRECTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          defaultValue={Number(r.amount ?? 0)}
                          className="field tnum px-2 py-1 text-xs"
                          aria-label="Net amount"
                        />
                        <input
                          name="vat_amount"
                          type="number"
                          step="0.01"
                          defaultValue={Number(r.vat_amount ?? 0)}
                          className="field tnum px-2 py-1 text-xs"
                          aria-label="VAT amount"
                        />
                        <input
                          name="currency"
                          defaultValue={r.currency ?? "AED"}
                          maxLength={8}
                          className="field px-2 py-1 text-xs uppercase"
                          aria-label="Currency"
                        />
                        <div className="flex items-center gap-2 justify-self-end">
                          {r.confidence != null && (
                            <span
                              className="tnum text-xs text-ink-soft"
                              title="AI confidence"
                            >
                              {Math.round(Number(r.confidence) * 100)}%
                            </span>
                          )}
                          <button type="submit" className="btn-ghost px-2.5 py-1 text-xs">
                            Save
                          </button>
                        </div>
                      </form>
                      <div className="mt-2 flex items-center gap-3 pl-1">
                        <StatusBadge status={r.status} />
                        <span className="text-xs text-ink-soft">
                          {r.source === "ai" ? "AI draft" : "Added by hand"}
                        </span>
                        <form action={setLedgerStatus} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="company_id" value={company.id} />
                          <select
                            name="status"
                            defaultValue={r.status}
                            className="field w-32 px-2 py-1 text-xs"
                            aria-label="Set line status"
                          >
                            <option value="draft">Draft</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="approved">Approved</option>
                          </select>
                          <button type="submit" className="btn-ghost px-2.5 py-1 text-xs">
                            Set
                          </button>
                        </form>
                        <form action={deleteLedgerEntry} className="ml-auto">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="company_id" value={company.id} />
                          <button type="submit" className="text-xs text-danger hover:underline">
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add a line by hand */}
        <h2 className="mt-10 font-display text-xl font-medium">Add a line by hand</h2>
        <form action={addLedgerEntry} className="card mt-4">
          <input type="hidden" name="company_id" value={company.id} />
          <div className="grid gap-2 sm:grid-cols-[110px_1.4fr_1fr_140px_100px_100px_100px_auto]">
            <input type="date" name="entry_date" className="field px-2 py-1.5 text-sm" aria-label="Date" />
            <input name="description" required placeholder="Description" className="field px-2 py-1.5 text-sm" aria-label="Description" />
            <input name="counterparty" placeholder="Counterparty" className="field px-2 py-1.5 text-sm" aria-label="Counterparty" />
            <select name="category" defaultValue="uncategorised" className="field px-2 py-1.5 text-sm" aria-label="Category">
              {LEDGER_CATEGORIES.map((c) => (
                <option key={c} value={c}>{catLabel(c)}</option>
              ))}
            </select>
            <select name="direction" defaultValue="expense" className="field px-2 py-1.5 text-sm" aria-label="Direction">
              {DIRECTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <input name="amount" type="number" step="0.01" placeholder="Net" className="field tnum px-2 py-1.5 text-sm" aria-label="Net amount" />
            <input name="vat_amount" type="number" step="0.01" placeholder="VAT" className="field tnum px-2 py-1.5 text-sm" aria-label="VAT amount" />
            <button type="submit" className="btn-primary">Add</button>
          </div>
        </form>

        <p className="mt-8 text-xs text-ink-soft">
          AI-generated figures are drafts for review by a licensed FTA tax agent. Not a
          substitute for formal tax advice.
        </p>
      </div>
    </>
  );
}
