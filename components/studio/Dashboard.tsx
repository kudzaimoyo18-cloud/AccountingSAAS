"use client";

import { useStudio } from "./StudioProvider";
import { ImportButton } from "./ImportButton";
import { Sparkline } from "./ui";
import { money, longDate, pct } from "@/lib/demo/format";
import { REGIONS } from "@/lib/demo/regions";

export function Dashboard({ onGoReview }: { onGoReview: () => void }) {
  const { region, reports } = useStudio();
  const cfg = REGIONS[region];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {cfg.client.name}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{cfg.client.sector}</p>
        </div>
        <ImportButton />
      </div>

      {reports.reviewCount > 0 && (
        <button
          onClick={onGoReview}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-brass/40 bg-brass/5 px-5 py-3 text-left transition-colors hover:bg-brass/10"
        >
          <span className="flex items-center gap-3 text-sm">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brass/15 text-brass-deep">
              {reports.reviewCount}
            </span>
            <span>
              <span className="font-medium text-ink">transactions need a quick review</span>
              <span className="text-ink-soft"> — everything else is auto-posted.</span>
            </span>
          </span>
          <span className="text-sm font-medium text-brass-deep">Review →</span>
        </button>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Money in" value={money(reports.moneyIn, region)} tone="up" />
        <Kpi label="Money out" value={money(reports.moneyOut, region)} tone="down" />
        <Kpi
          label="Net profit"
          value={money(reports.netProfit, region)}
          tone="up"
          spark={reports.byMonth.map((m) => m.profit)}
        />
        <Kpi
          label={`${cfg.vatLabel} due · ${cfg.vatPeriod}`}
          value={money(reports.vatDue, region)}
          sub={`${money(reports.outputVat, region)} out − ${money(reports.inputVat, region)} in`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* P&L snapshot */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Profit &amp; loss</h2>
            <span className="text-xs text-ink-soft">Apr – Jun 2026</span>
          </div>
          <div className="mt-5 space-y-4">
            <PnlRow label="Revenue" value={money(reports.revenue, region)} bar={1} tone="income" />
            <PnlRow
              label="Cost of goods sold"
              value={money(-reports.cogs, region)}
              bar={safe(reports.cogs, reports.revenue)}
              tone="expense"
            />
            <PnlRow
              label="Operating expenses"
              value={money(-reports.operatingExpenses, region)}
              bar={safe(reports.operatingExpenses, reports.revenue)}
              tone="expense"
            />
            <div className="flex items-center justify-between border-t border-line pt-4">
              <span className="font-medium">Net profit</span>
              <span className="tnum font-display text-xl font-semibold text-evergreen">
                {money(reports.netProfit, region)}
              </span>
            </div>
            <p className="tnum text-xs text-ink-soft">
              Net margin {pct(reports.revenue ? reports.netProfit / reports.revenue : 0)} · {reports.postedCount} posted entries
            </p>
          </div>
        </div>

        {/* Tax + deadline */}
        <div className="space-y-4">
          <div className="card">
            <p className="eyebrow">{cfg.taxName}</p>
            <p className="tnum mt-2 font-display text-2xl font-semibold">
              {reports.withinFreeBand ? money(0, region) : money(reports.taxSetAside, region)}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {reports.withinFreeBand
                ? `On track — within the 0% band. ${cfg.taxNote}`
                : `Set aside this period · est. on run-rate. ${cfg.taxNote}`}
            </p>
          </div>
          <div className="card">
            <p className="eyebrow">Next filing</p>
            <p className="mt-2 font-medium">{cfg.nextDeadline.label}</p>
            <p className="tnum mt-1 text-sm text-ink-soft">{longDate(cfg.nextDeadline.date, region)}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-brass-deep">
              <span className="h-1.5 w-1.5 rounded-full bg-brass" />
              {cfg.filingAuthority}
            </p>
          </div>
        </div>
      </div>

      {/* Auto-categorisation proof */}
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-evergreen/10 text-evergreen">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m13.5-6.5-1.5 1.5M7 17l-1.5 1.5M16.5 18.5 15 17M7 7 5.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </div>
          <div>
            <p className="tnum font-display text-2xl font-semibold">{pct(reports.autoCategorisedPct)}</p>
            <p className="text-sm text-ink-soft">auto-categorised &amp; posted by Mizan</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Sparkline values={reports.byMonth.map((m) => m.profit)} className="h-8" />
          <p className="max-w-[16rem] text-xs text-ink-soft">
            {reports.totalCount} transactions ingested · {reports.reviewCount} flagged for a human · the rest booked automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  spark,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
  spark?: number[];
}) {
  const accent = tone === "up" ? "text-evergreen" : tone === "down" ? "text-ink" : "text-ink";
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={`tnum mt-2 font-display text-2xl font-semibold ${accent}`}>{value}</p>
      {sub && <p className="tnum mt-1 text-xs text-ink-soft">{sub}</p>}
      {spark && spark.length > 0 && <Sparkline values={spark} className="mt-3 h-6" />}
    </div>
  );
}

function PnlRow({
  label,
  value,
  bar,
  tone,
}: {
  label: string;
  value: string;
  bar: number;
  tone: "income" | "expense";
}) {
  const color = tone === "income" ? "bg-evergreen" : "bg-brass";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="tnum font-medium">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper-dim">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, bar * 100)}%` }} />
      </div>
    </div>
  );
}

function safe(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(1, part / whole);
}
