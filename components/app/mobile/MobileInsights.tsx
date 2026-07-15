import Link from "next/link";

// Cash Now mobile Insights (design: MOBILE › Mobile INSIGHTS). 2×2 KPI grid,
// "Where money went" category bars, navy VAT card. Wired to loadStatements.

function money(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type InsightKpi = { label: string; value: string; tone?: "positive" | "danger" };
export type SpendCat = { name: string; pct: number };

export function MobileInsights({
  kpis,
  cats,
  vatDue,
  currency,
  hasData,
}: {
  kpis: InsightKpi[];
  cats: SpendCat[];
  vatDue: number;
  currency: string;
  hasData: boolean;
}) {
  return (
    <div className="rise">
      <h1 className="mb-4 text-[22px] font-extrabold tracking-[-0.02em] text-ink">Insights</h1>

      {!hasData ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm font-semibold text-ink">No posted figures yet</p>
          <p className="mx-auto mt-1 max-w-[16rem] text-[0.82rem] text-ink-soft">
            Approve a ledger line and your insights build here automatically.
          </p>
          <Link href="/app/books/ledger" className="btn-primary btn-sm mt-4">
            Open ledger
          </Link>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="mb-[18px] grid grid-cols-2 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-[18px] border border-line bg-surface p-[15px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-ink-soft">{k.label}</p>
                <p className={`tnum mt-[7px] text-[18px] font-extrabold ${k.tone === "positive" ? "text-evergreen" : k.tone === "danger" ? "text-danger" : "text-ink"}`}>
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          {/* where money went */}
          <div className="mb-4 rounded-[22px] border border-line bg-surface p-5">
            <h2 className="mb-3.5 text-[14px] font-extrabold text-ink">Where money went</h2>
            {cats.length === 0 ? (
              <p className="text-[0.82rem] text-ink-soft">No expenses categorised yet.</p>
            ) : (
              cats.map((c) => (
                <div key={c.name} className="mb-3">
                  <div className="mb-[5px] flex justify-between text-[12px] font-semibold">
                    <span className="text-ink">{c.name}</span>
                    <span className="tnum text-ink-soft">{c.pct}%</span>
                  </div>
                  <div className="h-[7px] rounded-full bg-paper-dim">
                    <div className="h-full rounded-full bg-evergreen" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* navy VAT card */}
          <div className="rounded-[22px] bg-sidebar p-5 text-sidebar-fg">
            <p className="text-[12px] text-sidebar-muted">VAT due (5%)</p>
            <p className="tnum my-1.5 text-[26px] font-extrabold">
              {currency} {money(vatDue)}
            </p>
            <Link href="/app/reports" className="btn-primary mt-2 w-full">
              Review VAT return
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
