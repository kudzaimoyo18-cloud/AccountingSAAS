"use client";

import { useStudio } from "./StudioProvider";
import { money } from "@/lib/demo/format";
import { REGIONS } from "@/lib/demo/regions";

export function ReportsView() {
  const { region, reports } = useStudio();
  const cfg = REGIONS[region];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Filing-ready</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Generated live from the ledger — export to {cfg.filingAuthority}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profit & loss statement */}
        <div className="card">
          <h2 className="font-display text-lg font-semibold">Profit &amp; loss</h2>
          <p className="text-xs text-ink-soft">Apr – Jun 2026</p>

          <Section title="Income" />
          {reports.incomeLines.map((l) => (
            <Line key={l.code} label={l.name} value={money(l.amount, region)} />
          ))}
          <Subtotal label="Total revenue" value={money(reports.revenue, region)} />

          <Section title="Expenses" />
          {reports.expenseLines.map((l) => (
            <Line key={l.code} label={l.name} value={money(-l.amount, region)} />
          ))}
          <Subtotal label="Total expenses" value={money(-reports.totalExpenses, region)} />

          <div className="mt-4 flex items-center justify-between border-t-2 border-ink/20 pt-4">
            <span className="font-display text-base font-semibold">Net profit</span>
            <span className="tnum font-display text-xl font-semibold text-evergreen">
              {money(reports.netProfit, region)}
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {/* VAT return */}
          <div className="card">
            <h2 className="font-display text-lg font-semibold">{cfg.vatReturnName}</h2>
            <p className="text-xs text-ink-soft">{cfg.vatLabel} · current period</p>
            <div className="mt-4 space-y-1">
              <Line label="VAT on sales (output)" value={money(reports.outputVat, region)} />
              <Line label="VAT on purchases (input)" value={money(-reports.inputVat, region)} />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-paper-dim px-4 py-3">
              <span className="font-medium">Net VAT due</span>
              <span className="tnum font-display text-lg font-semibold">{money(reports.vatDue, region)}</span>
            </div>
          </div>

          {/* Balance sheet snapshot */}
          <div className="card">
            <h2 className="font-display text-lg font-semibold">Balance sheet</h2>
            <p className="text-xs text-ink-soft">As at 30 Jun 2026</p>
            <div className="mt-4 space-y-1">
              <Line label="Bank / cash" value={money(reports.cashBalance, region)} />
              <Line label="VAT control" value={money(-reports.vatLiability, region)} />
              <Subtotal label="Owner's equity" value={money(reports.equity, region)} />
            </div>
          </div>

          {/* Tax estimate */}
          <div className="card">
            <h2 className="font-display text-lg font-semibold">{cfg.taxName}</h2>
            <div className="mt-3 space-y-1">
              <Line label="Projected annual profit" value={money(reports.annualProjectedProfit, region)} />
              <Line label="0% band" value={money(cfg.taxFreeThreshold, region)} />
              <Subtotal
                label="Estimated tax (period)"
                value={reports.withinFreeBand ? money(0, region) : money(reports.taxSetAside, region)}
              />
            </div>
            <p className="mt-2 text-xs text-ink-soft">{cfg.taxNote}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-brass-deep">{title}</p>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="tnum text-ink">{value}</span>
    </div>
  );
}

function Subtotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex items-center justify-between border-t border-line pt-2 text-sm">
      <span className="font-medium">{label}</span>
      <span className="tnum font-semibold">{value}</span>
    </div>
  );
}
