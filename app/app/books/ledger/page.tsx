import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { BooksTabs } from "@/components/books/BooksTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { getProfile } from "@/lib/portal";
import { getActiveCompany } from "@/lib/books/repo";
import { createClient } from "@/lib/supabase/server";
import { LEDGER_CATEGORIES } from "@/lib/ai";
import {
  extractDocument,
  updateLedgerEntry,
  setLedgerStatus,
  addLedgerEntry,
  deleteLedgerEntry,
} from "@/lib/books/ledger-actions";

export const metadata = { title: "Ledger — Mizan" };

const DIRECTIONS = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

function catLabel(c: string) {
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function money(n: number) {
  return n.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type LedgerRow = {
  id: string;
  entry_date: string | null;
  description: string | null;
  counterparty: string | null;
  category: string;
  direction: "income" | "expense";
  amount: number | string;
  vat_amount: number | string;
  currency: string | null;
  confidence: number | string | null;
  source: string;
  status: string;
};

type DocRow = {
  id: string;
  original_name: string;
  kind: string;
  created_at: string;
};

export default async function BooksLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { profile } = await getProfile();
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const { error, ok } = await searchParams;
  const supabase = await createClient();

  const [{ data: entries }, { data: docs }] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("company_id", company.id)
      .order("entry_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select("id, original_name, kind, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
  ]);

  const rows = (entries ?? []) as LedgerRow[];
  const docList = (docs ?? []) as DocRow[];

  const income = rows.filter((r) => r.direction === "income");
  const expense = rows.filter((r) => r.direction === "expense");
  const sum = (arr: LedgerRow[], key: "amount" | "vat_amount") =>
    arr.reduce((t, r) => t + Number(r[key] ?? 0), 0);

  const totalIncome = sum(income, "amount");
  const totalExpense = sum(expense, "amount");
  const net = totalIncome - totalExpense;
  const vatCollected = sum(income, "vat_amount");
  const vatPaid = sum(expense, "vat_amount");

  return (
    <PortalShell active="/app/books" isAdmin={profile?.role === "admin"}>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Ledger
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Upload an invoice or statement and let Mizan draft the accounting.
              Every column is editable — correct anything, then mark each line
              reviewed or approved.
            </p>
          </div>
          <Link href="/app/documents" className="btn-primary">
            Upload documents
          </Link>
        </div>

        <div className="mt-6">
          <BooksTabs active="ledger" />
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error.replace(/\+/g, " ")}
          </p>
        )}
        {ok && (
          <p className="mt-4 text-sm text-evergreen">{ok.replace(/\+/g, " ")}.</p>
        )}

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
              <p className="tnum mt-1 text-xl font-semibold">
                AED {money(c.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Run AI extraction on a document */}
        <h2 className="mt-10 font-display text-xl font-medium">
          Extract from a document
        </h2>
        {docList.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            No documents yet.{" "}
            <Link href="/app/documents" className="underline">
              Upload an invoice or statement
            </Link>{" "}
            and Mizan will draft the ledger lines for you.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
            {docList.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {d.original_name}
                  </p>
                  <p className="tnum mt-0.5 text-xs text-ink-soft">
                    {d.kind} ·{" "}
                    {new Date(d.created_at).toLocaleDateString("en-AE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <form action={extractDocument}>
                  <input type="hidden" name="document_id" value={d.id} />
                  <button
                    type="submit"
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
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
            No lines yet. Extract from a document above, or add one by hand below.
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
                            <option key={c} value={c}>
                              {catLabel(c)}
                            </option>
                          ))}
                        </select>
                        <select
                          name="direction"
                          defaultValue={r.direction}
                          className="field px-2 py-1 text-xs"
                          aria-label="Direction"
                        >
                          {DIRECTIONS.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
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
                          <button
                            type="submit"
                            className="btn-ghost px-2.5 py-1 text-xs"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                      <div className="mt-2 flex items-center gap-3 pl-1">
                        <StatusBadge status={r.status} />
                        <span className="text-xs text-ink-soft">
                          {r.source === "ai" ? "AI draft" : "Added by hand"}
                        </span>
                        <form
                          action={setLedgerStatus}
                          className="flex items-center gap-1"
                        >
                          <input type="hidden" name="id" value={r.id} />
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
                          <button
                            type="submit"
                            className="btn-ghost px-2.5 py-1 text-xs"
                          >
                            Set
                          </button>
                        </form>
                        <form action={deleteLedgerEntry} className="ml-auto">
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-xs text-danger hover:underline"
                          >
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
        <h2 className="mt-10 font-display text-xl font-medium">
          Add a line by hand
        </h2>
        <form action={addLedgerEntry} className="card mt-4">
          <div className="grid gap-2 sm:grid-cols-[110px_1.4fr_1fr_140px_100px_100px_100px_auto]">
            <input
              type="date"
              name="entry_date"
              className="field px-2 py-1.5 text-sm"
              aria-label="Date"
            />
            <input
              name="description"
              required
              placeholder="Description"
              className="field px-2 py-1.5 text-sm"
              aria-label="Description"
            />
            <input
              name="counterparty"
              placeholder="Counterparty"
              className="field px-2 py-1.5 text-sm"
              aria-label="Counterparty"
            />
            <select
              name="category"
              defaultValue="uncategorised"
              className="field px-2 py-1.5 text-sm"
              aria-label="Category"
            >
              {LEDGER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {catLabel(c)}
                </option>
              ))}
            </select>
            <select
              name="direction"
              defaultValue="expense"
              className="field px-2 py-1.5 text-sm"
              aria-label="Direction"
            >
              {DIRECTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              name="amount"
              type="number"
              step="0.01"
              placeholder="Net"
              className="field tnum px-2 py-1.5 text-sm"
              aria-label="Net amount"
            />
            <input
              name="vat_amount"
              type="number"
              step="0.01"
              placeholder="VAT"
              className="field tnum px-2 py-1.5 text-sm"
              aria-label="VAT amount"
            />
            <button type="submit" className="btn-primary">
              Add
            </button>
          </div>
        </form>

        <p className="mt-8 text-xs text-ink-soft">
          AI-generated figures are drafts for your review. Mizan is bookkeeping
          software, not a substitute for formal advice from a licensed FTA tax
          agent.
        </p>
      </div>
    </PortalShell>
  );
}
