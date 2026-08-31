import "server-only";

import { and, asc, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { ledgerEntries } from "@/lib/db/schema";
import { onlyThisCompany } from "@/lib/db/tenant";

// The ledger view and its CSV export must agree — "what you see is what you
// export" — so both build their WHERE clause here.
//
// The search term is bound as a parameter. The Supabase version interpolated it
// straight into a PostgREST `.or("description.ilike.%q%,...")` string, where a
// comma or parenthesis in the user's search text could rewrite the filter.

export type LedgerFilters = {
  q?: string;
  status?: string;
  direction?: string;
  category?: string;
  /** Limit to the current calendar month. */
  periodMonth?: boolean;
};

export function ledgerWhere(companyId: string, f: LedgerFilters): SQL {
  const extra: (SQL | undefined)[] = [];

  if (f.q) {
    // Escape the LIKE wildcards so a literal % or _ in the search box matches
    // itself instead of everything.
    const term = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    extra.push(
      or(ilike(ledgerEntries.description, term), ilike(ledgerEntries.counterparty, term)),
    );
  }
  if (f.status && ["draft", "reviewed", "approved"].includes(f.status)) {
    extra.push(eq(ledgerEntries.status, f.status));
  }
  if (f.direction && ["income", "expense"].includes(f.direction)) {
    extra.push(eq(ledgerEntries.direction, f.direction));
  }
  if (f.category) {
    extra.push(eq(ledgerEntries.category, f.category));
  }
  if (f.periodMonth) {
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    extra.push(gte(ledgerEntries.entryDate, firstOfMonth));
  }

  return onlyThisCompany(ledgerEntries, companyId, and(...(extra.filter(Boolean) as SQL[])));
}

/** Columns aliased back to snake_case, matching the row shapes the UI expects. */
export const ledgerColumns = {
  id: ledgerEntries.id,
  document_id: ledgerEntries.documentId,
  entry_date: ledgerEntries.entryDate,
  description: ledgerEntries.description,
  counterparty: ledgerEntries.counterparty,
  category: ledgerEntries.category,
  direction: ledgerEntries.direction,
  currency: ledgerEntries.currency,
  amount: ledgerEntries.amount,
  vat_amount: ledgerEntries.vatAmount,
  confidence: ledgerEntries.confidence,
  source: ledgerEntries.source,
  status: ledgerEntries.status,
  notes: ledgerEntries.notes,
};

/**
 * Newest first for the on-screen ledger. `nulls last` keeps undated drafts at
 * the bottom instead of the top, matching the old nullsFirst: false ordering.
 */
export async function listLedgerEntries(companyId: string, f: LedgerFilters) {
  return db
    .select(ledgerColumns)
    .from(ledgerEntries)
    .where(ledgerWhere(companyId, f))
    .orderBy(sql`${ledgerEntries.entryDate} desc nulls last`, desc(ledgerEntries.createdAt));
}

/** Oldest first for the CSV export, so the file reads like a statement. */
export async function listLedgerEntriesForExport(companyId: string, f: LedgerFilters) {
  return db
    .select(ledgerColumns)
    .from(ledgerEntries)
    .where(ledgerWhere(companyId, f))
    .orderBy(sql`${ledgerEntries.entryDate} asc nulls last`, asc(ledgerEntries.createdAt));
}
