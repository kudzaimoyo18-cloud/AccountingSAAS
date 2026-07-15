import Link from "next/link";
import { redirect } from "next/navigation";
import { BooksTabs } from "@/components/books/BooksTabs";
import { LedgerTable, type LedgerRow } from "@/components/books/LedgerTable";
import { MobileMoney, type MobileMoneyRow } from "@/components/app/mobile/MobileMoney";
import { getActiveCompany } from "@/lib/books/repo";
import { createClient } from "@/lib/supabase/server";
import { LEDGER_CATEGORIES } from "@/lib/ai";
import { extractDocument, addLedgerEntry } from "@/lib/books/ledger-actions";

export const metadata = { title: "Ledger — Mizan" };
// "Extract with AI" downloads the document and runs Claude extraction — allow
// up to 60s so large receipts/statements don't hit the default timeout.
export const maxDuration = 60;

const DIRECTIONS = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];
const STATUSES = [
  { value: "draft", label: "AI draft" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
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

type DocRow = {
  id: string;
  original_name: string;
  kind: string;
  created_at: string;
};

type Filters = {
  q: string;
  status: string;
  direction: string;
  category: string;
};

// Build a ledger URL with one filter changed (empty value = remove filter).
function filterHref(current: Filters, patch: Partial<Filters>) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  if (next.direction) params.set("direction", next.direction);
  if (next.category) params.set("category", next.category);
  const qs = params.toString();
  return `/app/books/ledger${qs ? `?${qs}` : ""}`;
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Server-rendered dropdown chip: <details> keeps it JS-free.
function FilterChip({
  label,
  activeLabel,
  options,
  current,
  patchKey,
}: {
  label: string;
  activeLabel?: string;
  options: { value: string; label: string }[];
  current: Filters;
  patchKey: keyof Filters;
}) {
  const isActive = Boolean(activeLabel);
  return (
    <details className="relative">
      <summary
        className={`chip cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden ${
          isActive ? "chip-active" : ""
        }`}
      >
        {activeLabel ?? label}
        <ChevronDown />
      </summary>
      <div className="absolute left-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-raised">
        {isActive && (
          <Link
            href={filterHref(current, { [patchKey]: "" } as Partial<Filters>)}
            className="block px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-dim"
          >
            All ({label.toLowerCase()})
          </Link>
        )}
        {options.map((o) => (
          <Link
            key={o.value}
            href={filterHref(current, { [patchKey]: o.value } as Partial<Filters>)}
            className={`block px-4 py-2 text-sm hover:bg-paper-dim ${
              current[patchKey] === o.value
                ? "font-semibold text-evergreen"
                : "text-ink"
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

export default async function BooksLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    ok?: string;
    q?: string;
    status?: string;
    direction?: string;
    category?: string;
    period?: string;
  }>;
}) {
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const sp = await searchParams;
  const { error, ok } = sp;
  const filters: Filters = {
    q: sp.q?.trim() ?? "",
    status: STATUSES.some((s) => s.value === sp.status) ? sp.status! : "",
    direction: DIRECTIONS.some((d) => d.value === sp.direction)
      ? sp.direction!
      : "",
    category: (LEDGER_CATEGORIES as readonly string[]).includes(
      sp.category ?? "",
    )
      ? sp.category!
      : "",
  };
  const periodMonth = sp.period === "month";
  const hasFilters = Boolean(
    filters.q || filters.status || filters.direction || filters.category || periodMonth,
  );

  const supabase = await createClient();

  let entriesQuery = supabase
    .from("ledger_entries")
    .select("*")
    .eq("company_id", company.id)
    .order("entry_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (filters.q) {
    entriesQuery = entriesQuery.or(
      `description.ilike.%${filters.q}%,counterparty.ilike.%${filters.q}%`,
    );
  }
  if (filters.status) entriesQuery = entriesQuery.eq("status", filters.status);
  if (filters.direction) {
    entriesQuery = entriesQuery.eq("direction", filters.direction);
  }
  if (filters.category) {
    entriesQuery = entriesQuery.eq("category", filters.category);
  }
  if (periodMonth) {
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    entriesQuery = entriesQuery.gte("entry_date", firstOfMonth);
  }

  const [{ data: entries }, { data: docs }] = await Promise.all([
    entriesQuery,
    supabase
      .from("documents")
      .select("id, original_name, kind, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
  ]);

  const rows = (entries ?? []).map((r) => ({
    ...r,
    amount: Number(r.amount ?? 0),
    vat_amount: Number(r.vat_amount ?? 0),
    confidence: r.confidence == null ? null : Number(r.confidence),
  })) as LedgerRow[];
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

  const filterQs = filterHref(filters, {}).split("?")[1] ?? "";
  const exportHref = `/app/books/ledger/export${filterQs ? `?${filterQs}` : ""}`;

  // Mobile Money filter chips (design labels), wired to real ledger filters.
  const noFilter = !hasFilters;
  const mobileChips = [
    { label: "All", href: "/app/books/ledger", active: noFilter },
    { label: "Income", href: "/app/books/ledger?direction=income", active: filters.direction === "income" },
    { label: "Expenses", href: "/app/books/ledger?direction=expense", active: filters.direction === "expense" },
    { label: "Needs review", href: "/app/books/ledger?status=draft", active: filters.status === "draft" },
    { label: "This month", href: "/app/books/ledger?period=month", active: periodMonth },
  ];

  return (
    <>
    {/* mobile Money (Cash Now) */}
    <div className="md:hidden">
      <MobileMoney rows={rows as MobileMoneyRow[]} chips={mobileChips} hasFilters={hasFilters} />
    </div>

    {/* desktop ledger */}
    <div className="mx-auto hidden max-w-6xl md:block">
      <BooksTabs active="ledger" />

      {error && (
        <div role="alert" className="alert-banner alert-banner-danger mt-4">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
            <path d="M8 1 1 14h14zM8 6v3.5M8 12h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {error.replace(/\+/g, " ")}
        </div>
      )}
      {ok && (
        <div className="alert-banner alert-banner-positive mt-4">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {ok.replace(/\+/g, " ")}.
        </div>
      )}

      {/* toolbar: filter chips left, exports right (Stitch ledger layout) */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="Status"
            activeLabel={STATUSES.find((s) => s.value === filters.status)?.label}
            options={STATUSES}
            current={filters}
            patchKey="status"
          />
          <FilterChip
            label="Direction"
            activeLabel={
              DIRECTIONS.find((d) => d.value === filters.direction)?.label
            }
            options={DIRECTIONS}
            current={filters}
            patchKey="direction"
          />
          <FilterChip
            label="Category"
            activeLabel={filters.category ? catLabel(filters.category) : undefined}
            options={LEDGER_CATEGORIES.map((c) => ({
              value: c,
              label: catLabel(c),
            }))}
            current={filters}
            patchKey="category"
          />
          {filters.q && (
            <Link
              href={filterHref(filters, { q: "" })}
              className="chip chip-active"
              title="Clear search"
            >
              “{filters.q}”
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Link>
          )}
          {hasFilters && (
            <Link
              href="/app/books/ledger"
              className="px-2 text-[0.8rem] font-medium text-evergreen hover:underline"
            >
              Clear all
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href={exportHref} className="btn-ghost btn-sm">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 10V2M5 5l3-3 3 3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </a>
          <a href="/app/books/pack" className="btn-primary btn-sm">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Audit pack
          </a>
        </div>
      </div>

      {/* Totals */}
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Income (net)", value: totalIncome },
          { label: "Expense (net)", value: totalExpense },
          { label: "Net", value: net },
          { label: "VAT (out − in)", value: vatCollected - vatPaid },
        ].map((c) => (
          <div key={c.label} className="kpi">
            <p className="kpi-label">{c.label}</p>
            <p className="kpi-value">AED {money(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Editable ledger */}
      {rows.length === 0 ? (
        <div className="card mt-5 text-center">
          <p className="text-sm font-medium text-ink">
            {hasFilters ? "No lines match these filters." : "No ledger lines yet."}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {hasFilters ? (
              <Link href="/app/books/ledger" className="text-evergreen underline">
                Clear the filters
              </Link>
            ) : (
              <>
                Extract from a document below, or add a line by hand — Mizan
                drafts the accounting, you approve it.
              </>
            )}
          </p>
        </div>
      ) : (
        <LedgerTable rows={rows} categories={LEDGER_CATEGORIES} />
      )}

      {/* Run AI extraction on a document */}
      <div className="panel mt-8">
        <div className="panel-header">
          <h2 className="panel-title">Extract from a document</h2>
          <Link href="/app/documents" className="btn-ghost btn-sm">
            Upload documents
          </Link>
        </div>
        {docList.length === 0 ? (
          <p className="panel-body text-sm text-ink-soft">
            No documents yet.{" "}
            <Link href="/app/documents" className="text-evergreen underline">
              Upload an invoice or statement
            </Link>{" "}
            and Mizan will draft the ledger lines for you.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {docList.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.original_name}</p>
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
                  <button type="submit" className="btn-primary btn-sm">
                    Extract with AI
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add a line by hand */}
      <div className="panel mt-6">
        <div className="panel-header">
          <h2 className="panel-title">Add a line by hand</h2>
        </div>
        <form action={addLedgerEntry} className="panel-body">
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
            <button type="submit" className="btn-primary btn-sm">
              Add
            </button>
          </div>
        </form>
      </div>

      <p className="mt-8 text-xs text-ink-soft">
        AI-generated figures are drafts for your review. Mizan is bookkeeping
        software, not a substitute for formal advice from a licensed FTA tax
        agent.
      </p>
    </div>
    </>
  );
}
