import "server-only";

// Single source of truth for the customer-facing headline numbers (assistant,
// printable pack, Excel pack, close page). Everything is derived from the
// DOUBLE-ENTRY journals — the same posted books that /app and /app/reports read
// via loadStatements — so no surface can disagree with another. This replaces
// the old buildReports(transactions) path on those surfaces, which returned
// zeros for AI-extraction customers whose data lives only in the ledger.
//
// The pure mapping lives in summary-core.ts (unit-tested). This module only does
// the DB reads and hands off.

import { loadStatements } from "./statements";
import { db } from "@/lib/db";
import { ledgerEntries } from "@/lib/db/schema";
import { onlyThisCompany } from "@/lib/db/tenant";
import { profitAndLoss, balanceSheet, type PostedLine } from "@/lib/accounting";
import { computeVat } from "@/lib/tax";
import {
  summarizeStatements,
  ledgerEntryToTxn,
  type LedgerEntryRow,
} from "./summary-core";
import type { Reports } from "./reports";
import type { BooksCompany } from "./repo";
import type { Txn } from "./types";

export { summarizeStatements } from "./summary-core";

/**
 * Load the company's headline numbers from the double-entry journals, plus the
 * approved-ledger detail rows for the Excel pack. Both reads are scoped by the
 * caller's company id, which comes from the session via requireTenant().
 */
export async function loadSummary(
  company: BooksCompany,
): Promise<{ reports: Reports; ledgerTxns: Txn[] }> {
  const { lines } = await loadStatements(company.id);

  // Aliased back to the database's snake_case names so LedgerEntryRow and the
  // pure mapping in summary-core.ts keep the exact shape they were written for.
  const ledgerRaw = await db
    .select({
      id: ledgerEntries.id,
      entry_date: ledgerEntries.entryDate,
      description: ledgerEntries.description,
      counterparty: ledgerEntries.counterparty,
      direction: ledgerEntries.direction,
      category: ledgerEntries.category,
      amount: ledgerEntries.amount,
      vat_amount: ledgerEntries.vatAmount,
      status: ledgerEntries.status,
      source: ledgerEntries.source,
    })
    .from(ledgerEntries)
    .where(onlyThisCompany(ledgerEntries, company.id));

  const ledger = ledgerRaw as unknown as LedgerEntryRow[];

  const approved = ledger.filter((l) => l.status === "approved");
  const reviewCount = ledger.length - approved.length;

  const dates = approved.map((l) => l.entry_date).filter((d): d is string => Boolean(d));
  const periodStart = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const periodEnd = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  const postedLines: PostedLine[] = lines;
  const reports = summarizeStatements({
    pnl: profitAndLoss(postedLines),
    vat: computeVat(postedLines),
    bs: balanceSheet(postedLines),
    postedCount: approved.length,
    reviewCount,
    periodStart,
    periodEnd,
    region: company.region as "ae" | "gb",
  });

  const ledgerTxns = approved
    .map(ledgerEntryToTxn)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { reports, ledgerTxns };
}
