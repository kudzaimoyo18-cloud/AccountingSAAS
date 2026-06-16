// Pure financial reporting derived from the ledger. Only POSTED transactions hit
// the books; items in review are excluded until a human approves them — so
// approving a flagged line visibly moves the numbers (accountant-correct).

import { accountByCode } from "./coa";
import { REGIONS } from "./regions";
import type { Region, Transaction } from "./types";

export interface GroupLine {
  code: string;
  name: string;
  amount: number; // positive magnitude
}

export interface MonthPoint {
  month: string; // YYYY-MM
  profit: number;
}

export interface Reports {
  moneyIn: number;
  moneyOut: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  totalExpenses: number;
  netProfit: number;

  outputVat: number;
  inputVat: number;
  vatDue: number;

  taxName: string;
  taxSetAside: number;
  annualProjectedProfit: number;
  withinFreeBand: boolean;

  incomeLines: GroupLine[];
  expenseLines: GroupLine[];

  cashBalance: number;
  vatLiability: number;
  equity: number;

  postedCount: number;
  reviewCount: number;
  totalCount: number;
  autoCategorisedPct: number;

  byMonth: MonthPoint[];
}

const COGS_CODE = "5000";

export function buildReports(txns: Transaction[], region: Region): Reports {
  const cfg = REGIONS[region];
  const posted = txns.filter((t) => t.status === "posted");

  let moneyIn = 0;
  let moneyOut = 0;
  let revenue = 0;
  let outputVat = 0;
  let inputVat = 0;

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();
  const monthMap = new Map<string, number>();

  for (const t of posted) {
    if (t.direction === "in") {
      moneyIn += t.amount;
      revenue += t.net;
      outputVat += t.vatAmount;
      incomeMap.set(t.accountCode ?? "4900", (incomeMap.get(t.accountCode ?? "4900") ?? 0) + t.net);
    } else {
      moneyOut += -t.amount;
      inputVat += -t.vatAmount; // vatAmount is negative on expenses
      const code = t.accountCode ?? "6800";
      expenseMap.set(code, (expenseMap.get(code) ?? 0) + -t.net);
    }
    const month = t.date.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + t.net);
  }

  const cogs = expenseMap.get(COGS_CODE) ?? 0;
  const totalExpenses = Array.from(expenseMap.values()).reduce((a, b) => a + b, 0);
  const operatingExpenses = totalExpenses - cogs;
  const grossProfit = revenue - cogs;
  const netProfit = revenue - totalExpenses;
  const vatDue = outputVat - inputVat;

  const annualProjectedProfit = netProfit * 4;
  const taxableAnnual = Math.max(0, annualProjectedProfit - cfg.taxFreeThreshold);
  const taxSetAside = round0((taxableAnnual * cfg.taxRate) / 4);
  const withinFreeBand = taxableAnnual === 0;

  const incomeLines = toLines(incomeMap, region);
  const expenseLines = toLines(expenseMap, region);

  const reviewCount = txns.filter((t) => t.status === "review").length;
  const totalCount = txns.length;
  const postedCount = posted.length;
  const autoCategorisedPct = totalCount === 0 ? 0 : postedCount / totalCount;

  const byMonth: MonthPoint[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, profit]) => ({ month, profit: round0(profit) }));

  return {
    moneyIn: round0(moneyIn),
    moneyOut: round0(moneyOut),
    revenue: round0(revenue),
    cogs: round0(cogs),
    grossProfit: round0(grossProfit),
    operatingExpenses: round0(operatingExpenses),
    totalExpenses: round0(totalExpenses),
    netProfit: round0(netProfit),
    outputVat: round0(outputVat),
    inputVat: round0(inputVat),
    vatDue: round0(vatDue),
    taxName: cfg.taxName,
    taxSetAside,
    annualProjectedProfit: round0(annualProjectedProfit),
    withinFreeBand,
    incomeLines,
    expenseLines,
    cashBalance: round0(cfg.client.sinceNet + moneyIn - moneyOut),
    vatLiability: round0(vatDue),
    equity: round0(cfg.client.sinceNet + netProfit),
    postedCount,
    reviewCount,
    totalCount,
    autoCategorisedPct,
    byMonth,
  };
}

function toLines(map: Map<string, number>, region: Region): GroupLine[] {
  return Array.from(map.entries())
    .map(([code, amount]) => ({
      code,
      name: accountByCode(region, code)?.name ?? code,
      amount: round0(amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function round0(n: number): number {
  return Math.round(n);
}
