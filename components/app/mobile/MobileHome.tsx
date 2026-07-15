import Link from "next/link";

// Cash Now mobile Home (design: MOBILE › Mobile HOME). Greeting header, navy
// net-position hero card, quick-action tiles, recent list. Mobile-only —
// rendered under md:hidden by the Overview page.

function money(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type MobileTxn = {
  id: string;
  description: string;
  category: string;
  direction: "income" | "expense";
  amount: number;
  currency: string;
  entry_date: string | null;
};

const QUICK = [
  { label: "Invoice", href: "/app/invoices/new", icon: "M4 2h8v12l-2-1.3L8 14l-2-1.3L4 14zM6.2 5.5h3.6M6.2 8h3.6" },
  { label: "Scan", href: "/app/capture", icon: "M2 5.5h2.5L6 3.5h4l1.5 2H14a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zM8 7.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" },
  { label: "Report", href: "/app/reports", icon: "M3 13V7M8 13V3M13 13v-4" },
  { label: "VAT", href: "/app/reports", icon: "M4 2h5l3 3v9H4zM9 2v3h3" },
];

export function MobileHome({
  companyName,
  initials,
  greeting,
  netProfit,
  deltaPct,
  currency,
  hasData,
  recent,
}: {
  companyName: string;
  initials: string;
  greeting: string;
  netProfit: number;
  deltaPct: number | null;
  currency: string;
  hasData: boolean;
  recent: MobileTxn[];
}) {
  const up = deltaPct != null && deltaPct >= 0;
  return (
    <div className="rise">
      {/* header: avatar + greeting, notifications bell */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-[42px] w-[42px] place-items-center rounded-full bg-evergreen-soft text-sm font-extrabold text-evergreen-deep">
            {initials}
          </span>
          <span>
            <span className="block text-xs text-ink-soft">{greeting}</span>
            <span className="block truncate text-[15px] font-extrabold text-ink">{companyName}</span>
          </span>
        </div>
        <Link
          href="/app/reviews"
          aria-label="Reviews"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink-soft"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 2a4 4 0 0 0-4 4v2.5L2.5 11h11L12 8.5V6a4 4 0 0 0-4-4zM6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* navy hero card */}
      <div className="relative mb-[18px] overflow-hidden rounded-[26px] bg-gradient-to-br from-sidebar-active to-sidebar p-[22px] text-sidebar-fg">
        <div className="pointer-events-none absolute -right-5 -top-8 h-32 w-32 rounded-full bg-evergreen/20" aria-hidden />
        <p className="text-[12.5px] text-sidebar-muted">Net profit</p>
        <p className="tnum mb-2 mt-2 text-[34px] font-extrabold tracking-[-0.02em]">
          {currency} {money(netProfit)}
        </p>
        {hasData && deltaPct != null && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${up ? "bg-evergreen/20 text-evergreen" : "bg-danger/20 text-danger"}`}>
            {up ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}% this month
          </span>
        )}
        <div className="mt-5 flex gap-2.5">
          <Link href="/app/capture" className="flex-1 rounded-2xl bg-evergreen py-3 text-center text-[13.5px] font-extrabold text-sidebar">
            Snap receipt
          </Link>
          <Link href="/app/invoices/new" className="flex-1 rounded-2xl border border-sidebar-muted/60 py-3 text-center text-[13.5px] font-extrabold text-sidebar-fg">
            New invoice
          </Link>
        </div>
      </div>

      {/* quick actions */}
      <div className="mb-5 flex justify-between">
        {QUICK.map((q) => (
          <Link key={q.label} href={q.href} className="flex flex-col items-center gap-[7px]">
            <span className="grid h-[52px] w-[52px] place-items-center rounded-[18px] border border-line bg-surface text-evergreen-deep">
              <svg width="21" height="21" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d={q.icon} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[11px] font-semibold text-ink-soft">{q.label}</span>
          </Link>
        ))}
      </div>

      {/* recent */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold text-ink">Recent</h2>
        <Link href="/app/books/ledger" className="text-[12.5px] font-bold text-evergreen-deep">
          See all
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-8 text-center">
          <p className="text-sm font-semibold text-ink">No activity yet</p>
          <p className="mx-auto mt-1 max-w-[16rem] text-[0.82rem] text-ink-soft">
            Snap a receipt and Mizan drafts your first ledger line.
          </p>
        </div>
      ) : (
        <ul>
          {recent.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b border-line py-[11px]">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-line bg-surface ${t.direction === "income" ? "text-positive" : "text-ink-soft"}`}>
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
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
                <span className="block truncate text-[13.5px] font-bold text-ink">{t.description}</span>
                <span className="block text-[11.5px] text-ink-soft">
                  {t.category}
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
