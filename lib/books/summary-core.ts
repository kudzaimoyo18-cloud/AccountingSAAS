// Pure mapping from the double-entry statements to the Reports shape used by the
// customer-facing packs/UI. No DB, no server-only — so it is unit-testable
// (summary.test.ts) and cannot silently drift from what /app/reports shows.

import {
  accountCodeFor,
  profitAndLoss,
  balanceSheet,
  ACC,
  round2,
} from "@/lib/accounting";
import type { VatSummary } from "@/lib/tax";
import { REGIONS } from "@/lib/demo/regions";
import type { Region } from "@/lib/demo/types";
import type { Reports, GroupLine } from "./reports";
import type { Txn } from "./types";

const COGS_CODE = "5000";

export interface SummaryInput {
  pnl: ReturnType<typeof profitAndLoss>;
  vat: VatSummary;
  bs: ReturnType<typeof balanceSheet>;
  postedCount: number; // approved ledger entries (posted to journals)
  reviewCount: number; // ledger entries not yet approved
  periodStart: string | null;
  periodEnd: string | null;
  region: Region;
}

function round0(n: number): number {
  return Math.round(n);
}

function monthsCovered(min: string | null, max: string | null): number {
  if (!min || !max) return 0;
  const days = (new Date(max).getTime() - new Date(min).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(1, days / 30.4);
}

/** Map the double-entry statements into the Reports shape the packs/UI expect. */
export function summarizeStatements(input: SummaryInput): Reports {
  const { pnl, vat, bs, region } = input;
  const cfg = REGIONS[region];

  const incomeLines: GroupLine[] = pnl.income
    .map((l) => ({ code: l.code, name: l.name, amount: round2(l.amount) }))
    .sort((a, b) => b.amount - a.amount);
  const expenseLines: GroupLine[] = pnl.expense
    .map((l) => ({ code: l.code, name: l.name, amount: round2(l.amount) }))
    .sort((a, b) => b.amount - a.amount);

  const revenue = round2(pnl.totalIncome);
  const totalExpenses = round2(pnl.totalExpense);
  const netProfit = round2(pnl.netProfit);
  const cogs = round2(pnl.expense.find((l) => l.code === COGS_CODE)?.amount ?? 0);
  const outputVat = round2(vat.output);
  const inputVat = round2(vat.input);
  const vatDue = round2(vat.net);

  // Bank balance from the balance sheet (asset code 1000); fall back to cash flow.
  const bankLine = bs.assets.find((a) => a.code === ACC.bank);
  const moneyIn = round2(revenue + outputVat);
  const moneyOut = round2(totalExpenses + inputVat);
  const cashBalance = bankLine ? round2(bankLine.amount) : round2(moneyIn - moneyOut);

  // Annualised corporate-tax projection — same method as the legacy reports so
  // the "set aside" figure is continuous with what customers saw before.
  const months = monthsCovered(input.periodStart, input.periodEnd);
  const annualProjectedProfit = months > 0 ? (netProfit * 12) / months : netProfit;
  const annualTaxable = Math.max(0, annualProjectedProfit - cfg.taxFreeThreshold);
  const annualTax = annualTaxable * cfg.taxRate;
  const taxSetAside = round0(months > 0 ? (annualTax * months) / 12 : annualTax);

  const totalCount = input.postedCount + input.reviewCount;

  return {
    moneyIn,
    moneyOut,
    revenue,
    cogs,
    grossProfit: round2(revenue - cogs),
    operatingExpenses: round2(totalExpenses - cogs),
    totalExpenses,
    netProfit,
    outputVat,
    inputVat,
    vatDue,
    taxName: cfg.taxName,
    taxSetAside,
    annualProjectedProfit: round0(annualProjectedProfit),
    withinFreeBand: annualTaxable === 0,
    incomeLines,
    expenseLines,
    cashBalance,
    vatLiability: vatDue,
    equity: netProfit,
    postedCount: input.postedCount,
    reviewCount: input.reviewCount,
    totalCount,
    autoCategorisedPct: totalCount === 0 ? 0 : input.postedCount / totalCount,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  };
}

export type LedgerEntryRow = {
  id: string;
  entry_date: string | null;
  description: string | null;
  counterparty: string | null;
  direction: "income" | "expense";
  category: string | null;
  amount: number | string;
  vat_amount: number | string;
  status: string;
  source: string | null;
};

/** Approved ledger entry -> Txn row, for the Excel pack's Ledger tab. */
export function ledgerEntryToTxn(e: LedgerEntryRow): Txn {
  const net = Number(e.amount);
  const vat = Number(e.vat_amount);
  const direction = e.direction === "income" ? "in" : "out";
  return {
    id: e.id,
    date: e.entry_date ?? "",
    description: e.description ?? "",
    counterparty: e.counterparty,
    amount: round2(net + vat),
    direction,
    accountCode: accountCodeFor(e.category ?? "uncategorised", e.direction),
    category: e.category,
    vatRate: 0,
    vatAmount: round2(vat),
    net: round2(net),
    status: "posted",
    confidence: null,
    source: e.source === "manual" ? "manual" : "ai",
    reason: null,
  };
}
