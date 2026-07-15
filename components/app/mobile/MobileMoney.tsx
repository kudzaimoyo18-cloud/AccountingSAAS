import Link from "next/link";

// Cash Now mobile Money (design: MOBILE › Mobile MONEY). "Transactions" with a
// horizontal-scroll filter chip row and a transaction list. Chips link to the
// ledger's real server-side filters. Mobile-only.

function money(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function catLabel(c: string) {
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export type MobileMoneyRow = {
  id: string;
  entry_date: string | null;
  description: string;
  category: string;
  direction: "income" | "expense";
  amount: number;
  currency: string;
  status: string;
};

export type MoneyChip = { label: string; href: string; active: boolean };

export function MobileMoney({
  rows,
  chips,
  hasFilters,
}: {
  rows: MobileMoneyRow[];
  chips: MoneyChip[];
  hasFilters: boolean;
}) {
  return (
    <div className="rise">
      <h1 className="mb-4 text-[22px] font-extrabold tracking-[-0.02em] text-ink">Transactions</h1>

      {/* filter chips — horizontal scroll */}
      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`whitespace-nowrap rounded-full border px-3.5 py-[7px] text-[12.5px] font-bold transition-colors ${
              c.active
                ? "border-evergreen bg-evergreen text-sidebar"
                : "border-line-strong bg-surface text-ink"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm font-semibold text-ink">
            {hasFilters ? "Nothing matches these filters." : "No transactions yet."}
          </p>
          <p className="mx-auto mt-1 max-w-[16rem] text-[0.82rem] text-ink-soft">
            {hasFilters ? (
              <Link href="/app/books/ledger" className="font-semibold text-evergreen-deep">
                Clear filters
              </Link>
            ) : (
              "Snap a receipt or import a statement to get started."
            )}
          </p>
        </div>
      ) : (
        <ul>
          {rows.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b border-line py-[13px]">
              <span className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] border border-line bg-surface ${t.direction === "income" ? "text-positive" : "text-ink-soft"}`}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d={t.direction === "income" ? "M3 11l3.5-3.5 2.5 2L13 5M13 5H9.5M13 5v3.5" : "M3 5l3.5 3.5 2.5-2L13 11M13 11H9.5M13 11V7.5"}
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-ink">{t.description || "Untitled"}</span>
                <span className="block text-[11.5px] text-ink-soft">
                  {catLabel(t.category)}
                  {t.entry_date && ` · ${new Date(t.entry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                </span>
              </span>
              <span className={`tnum whitespace-nowrap text-sm font-extrabold ${t.direction === "income" ? "text-positive" : "text-ink"}`}>
                {t.direction === "income" ? "+" : "−"}
                {money(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
