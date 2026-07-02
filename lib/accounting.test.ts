import { describe, it, expect } from "vitest";
import {
  postingLinesFor,
  trialBalance,
  profitAndLoss,
  balanceSheet,
  DEFAULT_CHART,
  type PostedLine,
  type AccountType,
} from "@/lib/accounting";

const META = new Map<string, { name: string; type: AccountType }>(
  DEFAULT_CHART.map((a) => [a.code, { name: a.name, type: a.type }]),
);

type Entry = Parameters<typeof postingLinesFor>[0];

function toPosted(entries: Entry[]): PostedLine[] {
  const lines: PostedLine[] = [];
  for (const e of entries) {
    for (const l of postingLinesFor(e)) {
      const m = META.get(l.code);
      if (!m) throw new Error(`no chart account for ${l.code}`);
      lines.push({ code: l.code, name: m.name, type: m.type, debit: l.debit, credit: l.credit });
    }
  }
  return lines;
}

describe("cash-basis posting", () => {
  it("expense entry balances and credits Bank for the gross", () => {
    const lines = postingLinesFor({ direction: "expense", category: "rent", amount: 100, vat_amount: 5 });
    const debit = lines.reduce((t, l) => t + l.debit, 0);
    const credit = lines.reduce((t, l) => t + l.credit, 0);
    expect(debit).toBeCloseTo(credit);
    expect(debit).toBeCloseTo(105);
    const bank = lines.find((l) => l.code === "1000");
    expect(bank?.credit).toBeCloseTo(105);
  });

  it("income entry balances and debits Bank for the gross", () => {
    const lines = postingLinesFor({ direction: "income", category: "sales_revenue", amount: 200, vat_amount: 10 });
    const debit = lines.reduce((t, l) => t + l.debit, 0);
    const credit = lines.reduce((t, l) => t + l.credit, 0);
    expect(debit).toBeCloseTo(credit);
    const bank = lines.find((l) => l.code === "1000");
    expect(bank?.debit).toBeCloseTo(210);
  });

  it("statements reconcile across a set of entries", () => {
    const lines = toPosted([
      { direction: "income", category: "sales_revenue", amount: 1000, vat_amount: 50 },
      { direction: "expense", category: "rent", amount: 300, vat_amount: 15 },
      { direction: "expense", category: "salaries_wages", amount: 400, vat_amount: 0 },
    ]);

    const tb = trialBalance(lines);
    expect(tb.totalDebit).toBeCloseTo(tb.totalCredit);

    const pnl = profitAndLoss(lines);
    expect(pnl.totalIncome).toBeCloseTo(1000);
    expect(pnl.totalExpense).toBeCloseTo(700);
    expect(pnl.netProfit).toBeCloseTo(300);

    expect(balanceSheet(lines).balanced).toBe(true);
  });
});
