import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, journalEntries, journalLines } from "@/lib/db/schema";
import {
  trialBalance,
  profitAndLoss,
  balanceSheet,
  type PostedLine,
  type AccountType,
} from "@/lib/accounting";
import { taxFromLines } from "@/lib/tax";

/**
 * Load the company's posted journal lines and derive the full double-entry
 * picture: trial balance, P&L, balance sheet, VAT and corporate tax. Shared by
 * /app and /app/reports so both read one source.
 *
 * The join to journal_entries is what scopes this to one tenant — journal_lines
 * has no company_id of its own, so the filter has to ride on its parent entry.
 * Supabase expressed the same thing with `journal_entries!inner(company_id)`.
 */
export async function postedLines(
  companyId: string,
  range?: { from: string; to: string },
): Promise<PostedLine[]> {
  const raw = await db
    .select({
      debit: journalLines.debit,
      credit: journalLines.credit,
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(
      range
        ? and(
            eq(journalEntries.companyId, companyId),
            gte(journalEntries.entryDate, range.from),
            lte(journalEntries.entryDate, range.to),
          )
        : eq(journalEntries.companyId, companyId),
    );

  return raw.map((r) => ({
    code: r.code,
    name: r.name,
    type: r.type as AccountType,
    debit: Number(r.debit),
    credit: Number(r.credit),
  }));
}

/** The full double-entry picture for one company. */
export async function loadStatements(companyId: string) {
  const lines = await postedLines(companyId);

  return {
    lines,
    tb: trialBalance(lines),
    pnl: profitAndLoss(lines),
    bs: balanceSheet(lines),
    tax: taxFromLines(lines),
    hasData: lines.length > 0,
  };
}
