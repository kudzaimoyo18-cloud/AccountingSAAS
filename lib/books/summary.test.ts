import { describe, it, expect } from "vitest";
import { summarizeStatements, ledgerEntryToTxn } from "./summary-core";
import {
  postingLinesFor,
  profitAndLoss,
  balanceSheet,
  DEFAULT_CHART,
  type PostedLine,
} from "@/lib/accounting";
import { computeVat } from "@/lib/tax";

// Build the posted double-entry lines the way the app does: expand each approved
// ledger entry via postingLinesFor and attach account metadata from the chart.
function toPostedLines(
  entries: { direction: "income" | "expense"; category: string; amount: number; vat_amount: number }[],
): PostedLine[] {
  const meta = new Map(DEFAULT_CHART.map((a) => [a.code, a]));
  const out: PostedLine[] = [];
  for (const e of entries) {
    for (const l of postingLinesFor(e)) {
      const a = meta.get(l.code)!;
      out.push({ code: a.code, name: a.name, type: a.type, debit: l.debit, credit: l.credit });
    }
  }
  return out;
}

function summarize(lines: PostedLine[], meta: Partial<Parameters<typeof summarizeStatements>[0]> = {}) {
  return summarizeStatements({
    pnl: profitAndLoss(lines),
    vat: computeVat(lines),
    bs: balanceSheet(lines),
    postedCount: 0,
    reviewCount: 0,
    periodStart: null,
    periodEnd: null,
    region: "ae",
    ...meta,
  });
}

describe("summarizeStatements", () => {
  it("reports revenue, expenses, profit and VAT from double-entry lines", () => {
    // Sale: net 10,000 + 5% VAT 500. Rent expense: net 2,000, no VAT.
    const lines = toPostedLines([
      { direction: "income", category: "sales_revenue", amount: 10000, vat_amount: 500 },
      { direction: "expense", category: "rent", amount: 2000, vat_amount: 0 },
    ]);
    const r = summarize(lines);

    expect(r.revenue).toBe(10000);
    expect(r.totalExpenses).toBe(2000);
    expect(r.netProfit).toBe(8000);
    expect(r.outputVat).toBe(500);
    expect(r.inputVat).toBe(0);
    expect(r.vatDue).toBe(500);
    // Cash = gross in (10,500) − gross out (2,000) = 8,500 (bank balance).
    expect(r.cashBalance).toBe(8500);
  });

  it("splits COGS out of total expenses for gross profit", () => {
    const lines = toPostedLines([
      { direction: "income", category: "sales_revenue", amount: 10000, vat_amount: 0 },
      { direction: "expense", category: "cost_of_sales", amount: 4000, vat_amount: 0 },
      { direction: "expense", category: "marketing", amount: 1000, vat_amount: 0 },
    ]);
    const r = summarize(lines);
    expect(r.cogs).toBe(4000);
    expect(r.grossProfit).toBe(6000); // revenue − cogs
    expect(r.operatingExpenses).toBe(1000); // everything but cogs
    expect(r.netProfit).toBe(5000);
  });

  it("nets input VAT against output VAT (recoverable purchases)", () => {
    const lines = toPostedLines([
      { direction: "income", category: "sales_revenue", amount: 10000, vat_amount: 500 },
      { direction: "expense", category: "software_subscriptions", amount: 1000, vat_amount: 50 },
    ]);
    const r = summarize(lines);
    expect(r.outputVat).toBe(500);
    expect(r.inputVat).toBe(50);
    expect(r.vatDue).toBe(450);
  });

  it("keeps corporate tax at zero below the AED 375k annual band", () => {
    // Small profit over a full year → projected annual profit under threshold.
    const lines = toPostedLines([
      { direction: "income", category: "sales_revenue", amount: 100000, vat_amount: 0 },
      { direction: "expense", category: "rent", amount: 20000, vat_amount: 0 },
    ]);
    const r = summarize(lines, { periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    expect(r.netProfit).toBe(80000);
    // Annualised over a full year stays well under the AED 375k band.
    expect(r.annualProjectedProfit).toBeGreaterThan(79000);
    expect(r.annualProjectedProfit).toBeLessThan(85000);
    expect(r.withinFreeBand).toBe(true);
    expect(r.taxSetAside).toBe(0);
  });

  it("charges 9% only on profit above the threshold, annualised", () => {
    // Net profit 475,000 over a full year → taxable 100,000 → 9,000 CT.
    const lines = toPostedLines([
      { direction: "income", category: "sales_revenue", amount: 500000, vat_amount: 0 },
      { direction: "expense", category: "salaries_wages", amount: 25000, vat_amount: 0 },
    ]);
    const r = summarize(lines, { periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    expect(r.netProfit).toBe(475000);
    expect(r.withinFreeBand).toBe(false);
    // ~(475k − 375k) * 9% ≈ 9,000, give or take the annualisation of a 364-day year.
    expect(r.taxSetAside).toBeGreaterThan(8500);
    expect(r.taxSetAside).toBeLessThan(9500);
  });

  it("is empty-safe with no posted lines", () => {
    const r = summarize([]);
    expect(r.revenue).toBe(0);
    expect(r.netProfit).toBe(0);
    expect(r.vatDue).toBe(0);
    expect(r.cashBalance).toBe(0);
    expect(r.autoCategorisedPct).toBe(0);
  });

  it("passes ledger counts through and computes auto-categorised %", () => {
    const r = summarize([], { postedCount: 8, reviewCount: 2 });
    expect(r.postedCount).toBe(8);
    expect(r.reviewCount).toBe(2);
    expect(r.totalCount).toBe(10);
    expect(r.autoCategorisedPct).toBe(0.8);
  });
});

describe("ledgerEntryToTxn", () => {
  it("maps an approved expense entry to a gross Txn row", () => {
    const t = ledgerEntryToTxn({
      id: "e1",
      entry_date: "2026-03-04",
      description: "AWS invoice",
      counterparty: "Amazon",
      direction: "expense",
      category: "software_subscriptions",
      amount: "1000",
      vat_amount: "50",
      status: "approved",
      source: "ai",
    });
    expect(t.direction).toBe("out");
    expect(t.net).toBe(1000);
    expect(t.vatAmount).toBe(50);
    expect(t.amount).toBe(1050); // gross
    expect(t.accountCode).toBe("5400"); // software_subscriptions
    expect(t.status).toBe("posted");
  });

  it("maps income direction to 'in'", () => {
    const t = ledgerEntryToTxn({
      id: "e2",
      entry_date: null,
      description: null,
      counterparty: null,
      direction: "income",
      category: "sales_revenue",
      amount: 5000,
      vat_amount: 250,
      status: "approved",
      source: "manual",
    });
    expect(t.direction).toBe("in");
    expect(t.amount).toBe(5250);
    expect(t.date).toBe("");
    expect(t.source).toBe("manual");
  });
});
