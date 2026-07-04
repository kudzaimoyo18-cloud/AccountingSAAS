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
import { createClient } from "@/lib/supabase/server";
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
 * approved-ledger detail rows for the Excel pack. RLS scopes both reads to the
 * caller (owner or invited agent).
 */
export async function loadSummary(
  company: BooksCompany,
): Promise<{ reports: Reports; ledgerTxns: Txn[] }> {
  const supabase = await createClient();
  const { lines } = await loadStatements(company.id);

  const { data: ledgerRaw } = await supabase
    .from("ledger_entries")
    .select("id, entry_date, description, counterparty, direction, category, amount, vat_amount, status, source")
    .eq("company_id", company.id);
  const ledger = (ledgerRaw ?? []) as LedgerEntryRow[];

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
    region: company.region,
  });

  const ledgerTxns = approved
    .map(ledgerEntryToTxn)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { reports, ledgerTxns };
}
