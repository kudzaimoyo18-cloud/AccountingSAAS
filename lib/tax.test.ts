import { describe, it, expect } from "vitest";
import { computeCorporateTax, computeVat, taxFromLines, CT_THRESHOLD } from "@/lib/tax";
import {
  postingLinesFor,
  DEFAULT_CHART,
  type PostedLine,
  type AccountType,
} from "@/lib/accounting";

const META = new Map<string, { name: string; type: AccountType }>(
  DEFAULT_CHART.map((a) => [a.code, { name: a.name, type: a.type }]),
);

type Entry = Parameters<typeof postingLinesFor>[0];

function toPosted(entries: Entry[]): PostedLine[] {
  return entries.flatMap((e) =>
    postingLinesFor(e).map((l) => {
      const m = META.get(l.code);
      if (!m) throw new Error(`no chart account for ${l.code}`);
      return { code: l.code, name: m.name, type: m.type, debit: l.debit, credit: l.credit };
    }),
  );
}

describe("corporate tax (9% over AED 375k)", () => {
  it("is zero at or below the threshold", () => {
    expect(computeCorporateTax(CT_THRESHOLD).tax).toBe(0);
    expect(computeCorporateTax(100000).tax).toBe(0);
  });
  it("is 9% of profit above the threshold", () => {
    const ct = computeCorporateTax(475000);
    expect(ct.taxable).toBeCloseTo(100000);
    expect(ct.tax).toBeCloseTo(9000);
  });
});

describe("VAT", () => {
  it("nets output minus input VAT from posted lines", () => {
    const lines = toPosted([
      { direction: "income", category: "sales_revenue", amount: 1000, vat_amount: 50 },
      { direction: "expense", category: "office_supplies", amount: 200, vat_amount: 10 },
    ]);
    const vat = computeVat(lines);
    expect(vat.output).toBeCloseTo(50);
    expect(vat.input).toBeCloseTo(10);
    expect(vat.net).toBeCloseTo(40);
  });

  it("ties net profit to the P&L", () => {
    const lines = toPosted([
      { direction: "income", category: "sales_revenue", amount: 1000, vat_amount: 50 },
      { direction: "expense", category: "rent", amount: 300, vat_amount: 15 },
    ]);
    expect(taxFromLines(lines).netProfit).toBeCloseTo(700);
  });
});
