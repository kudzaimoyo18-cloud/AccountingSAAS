// Financial reports derived purely from POSTED transactions. Items in review
// are excluded until a human approves them, so approving a flagged line visibly
// moves the numbers (accountant-correct).
//
// Amounts here are positive + direction-flagged (DB convention). Opening balance
// is 0 — these are the company's real books, not a seeded demo.

import { accountByCode } from "@/lib/demo/coa";
import { REGIONS } from "@/lib/demo/regions";
import type { Region } from "@/lib/demo/types";
import type { Txn } from "./types";

export interface GroupLine {
  code: string;
  name: string;
  amount: number;
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

  periodStart: string | null;
  periodEnd: string | null;
}

const COGS_CODE = "5000";

export function buildReports(txns: Txn[], region: Region): Reports {
  const cfg = REGIONS[region];
  const posted = txns.filter((t) => t.status === "posted");

  let moneyIn = 0;
  let moneyOut = 0;
  let revenue = 0;
  let outputVat = 0;
  let inputVat = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const t of posted) {
    if (t.direction === "in") {
      moneyIn += t.amount;
      revenue += t.net;
      outputVat += t.vatAmount;
      const code = t.accountCode ?? "4900";
      incomeMap.set(code, (incomeMap.get(code) ?? 0) + t.net);
    } else {
      moneyOut += t.amount;
      inputVat += t.vatAmount;
      const code = t.accountCode ?? "6800";
      expenseMap.set(code, (expenseMap.get(code) ?? 0) + t.net);
    }
    if (!minDate || t.date < minDate) minDate = t.date;
    if (!maxDate || t.date > maxDate) maxDate = t.date;
  }

  const cogs = expenseMap.get(COGS_CODE) ?? 0;
  const totalExpenses = sum(expenseMap.values());
  const operatingExpenses = totalExpenses - cogs;
  const grossProfit = revenue - cogs;
  const netProfit = revenue - totalExpenses;
  const vatDue = outputVat - inputVat;

  const months = monthsCovered(minDate, maxDate);
  const annualProjectedProfit = months > 0 ? (netProfit * 12) / months : netProfit;
  const annualTaxable = Math.max(0, annualProjectedProfit - cfg.taxFreeThreshold);
  const annualTax = annualTaxable * cfg.taxRate;
  const taxSetAside = round0(months > 0 ? (annualTax * months) / 12 : annualTax);
  const withinFreeBand = annualTaxable === 0;

  const reviewCount = txns.filter((t) => t.status === "review").length;
  const totalCount = txns.length;
  const postedCount = posted.length;

  return {
    moneyIn: round2(moneyIn),
    moneyOut: round2(moneyOut),
    revenue: round2(revenue),
    cogs: round2(cogs),
    grossProfit: round2(grossProfit),
    operatingExpenses: round2(operatingExpenses),
    totalExpenses: round2(totalExpenses),
    netProfit: round2(netProfit),
    outputVat: round2(outputVat),
    inputVat: round2(inputVat),
    vatDue: round2(vatDue),
    taxName: cfg.taxName,
    taxSetAside,
    annualProjectedProfit: round0(annualProjectedProfit),
    withinFreeBand,
    incomeLines: toLines(incomeMap, region),
    expenseLines: toLines(expenseMap, region),
    cashBalance: round2(moneyIn - moneyOut),
    vatLiability: round2(vatDue),
    equity: round2(netProfit),
    postedCount,
    reviewCount,
    totalCount,
    autoCategorisedPct: totalCount === 0 ? 0 : postedCount / totalCount,
    periodStart: minDate,
    periodEnd: maxDate,
  };
}

function toLines(map: Map<string, number>, region: Region): GroupLine[] {
  return Array.from(map.entries())
    .map(([code, amount]) => ({
      code,
      name: accountByCode(region, code)?.name ?? code,
      amount: round2(amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function monthsCovered(min: string | null, max: string | null): number {
  if (!min || !max) return 0;
  const a = new Date(min);
  const b = new Date(max);
  const days = (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(1, days / 30.4);
}

function sum(values: IterableIterator<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round0(n: number): number {
  return Math.round(n);
}
