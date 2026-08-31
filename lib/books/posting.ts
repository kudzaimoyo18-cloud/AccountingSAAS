import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  accounts as accountsTable,
  journalEntries,
  journalLines,
  ledgerEntries,
} from "@/lib/db/schema";
import { DEFAULT_CHART, postingLinesFor } from "@/lib/accounting";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Runner = typeof db | Tx;

/**
 * Insert the default chart of accounts for a company if it has none yet.
 * Returns a code -> account-id map.
 */
async function ensureChart(runner: Runner, companyId: string): Promise<Map<string, string>> {
  const existing = await runner
    .select({ id: accountsTable.id, code: accountsTable.code })
    .from(accountsTable)
    .where(eq(accountsTable.companyId, companyId));

  if (existing.length > 0) {
    return new Map(existing.map((a) => [a.code, a.id]));
  }

  const seeded = await runner
    .insert(accountsTable)
    .values(
      DEFAULT_CHART.map((a) => ({
        companyId,
        code: a.code,
        name: a.name,
        type: a.type,
        vatTreatment: a.vat_treatment,
      })),
    )
    // Another request may be seeding the same chart concurrently; take whichever
    // rows land and read the full set back below.
    .onConflictDoNothing()
    .returning({ id: accountsTable.id, code: accountsTable.code });

  if (seeded.length === DEFAULT_CHART.length) {
    return new Map(seeded.map((a) => [a.code, a.id]));
  }

  const all = await runner
    .select({ id: accountsTable.id, code: accountsTable.code })
    .from(accountsTable)
    .where(eq(accountsTable.companyId, companyId));
  return new Map(all.map((a) => [a.code, a.id]));
}

/**
 * Make the posted double-entry journals for ONE ledger entry match its current
 * state, so /app/reports always reflects the currently-approved books:
 *   - always removes any existing journal entry for this ledger line (idempotent),
 *   - if the line is 'approved', posts a fresh balanced journal entry (cash basis).
 * Safe to call after approve, un-approve, or edit.
 *
 * Returns { ok } so the caller can react to a posting failure (e.g. revert an
 * approval and tell the user) instead of the line silently staying unposted —
 * a line must never show "Approved" while it never reached Reports.
 *
 * Everything runs inside one database transaction. Under Supabase this was a
 * sequence of separate REST calls with a hand-rolled compensating delete when
 * the lines failed; on Neon the header and its lines commit together or not at
 * all, so an unbalanced or headerless journal cannot exist even if the process
 * dies mid-write.
 */
export type SyncResult = { ok: boolean; error?: string };

export async function syncJournalForEntry(
  companyId: string,
  ledgerEntryId: string,
): Promise<SyncResult> {
  try {
    return await db.transaction(async (tx) => {
      // Clear any prior journal for this ledger line first.
      await tx
        .delete(journalEntries)
        .where(
          and(
            eq(journalEntries.companyId, companyId),
            eq(journalEntries.ledgerEntryId, ledgerEntryId),
          ),
        );

      const [e] = await tx
        .select({
          id: ledgerEntries.id,
          entryDate: ledgerEntries.entryDate,
          description: ledgerEntries.description,
          direction: ledgerEntries.direction,
          category: ledgerEntries.category,
          amount: ledgerEntries.amount,
          vatAmount: ledgerEntries.vatAmount,
          status: ledgerEntries.status,
        })
        .from(ledgerEntries)
        .where(
          and(eq(ledgerEntries.id, ledgerEntryId), eq(ledgerEntries.companyId, companyId)),
        )
        .limit(1);

      // Not approved -> nothing should be posted; the clear above is the whole job.
      if (!e || e.status !== "approved") return { ok: true };

      const codeToId = await ensureChart(tx, companyId);
      const lines = postingLinesFor({
        direction: e.direction as "income" | "expense",
        category: e.category,
        amount: Number(e.amount),
        vat_amount: Number(e.vatAmount),
      });

      const resolved = lines.map((l) => ({
        accountId: codeToId.get(l.code),
        debit: l.debit,
        credit: l.credit,
      }));

      if (resolved.some((l) => !l.accountId)) {
        console.error("[syncJournal] missing account for ledger entry", e.id);
        // Throwing rolls the transaction back, including the clear above, so a
        // previously-good journal is not destroyed by a failed re-post.
        throw new PostingError("Chart of accounts is missing an account for this line.");
      }

      const [header] = await tx
        .insert(journalEntries)
        .values({
          companyId,
          ledgerEntryId: e.id,
          entryDate: e.entryDate ?? new Date().toISOString().slice(0, 10),
          memo: e.description ?? "",
          source: "ledger",
        })
        .returning({ id: journalEntries.id });

      if (!header) throw new PostingError("Could not create journal entry.");

      await tx.insert(journalLines).values(
        resolved.map((l) => ({
          entryId: header.id,
          accountId: l.accountId as string,
          debit: String(l.debit),
          credit: String(l.credit),
        })),
      );

      // Belt and braces on top of the database's deferred balance trigger: if
      // postingLinesFor ever returns a lopsided set, fail here rather than
      // commit books that do not add up.
      const totalDebit = resolved.reduce((s, l) => s + l.debit, 0);
      const totalCredit = resolved.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.005) {
        throw new PostingError(
          `Journal for ${e.id} is unbalanced: debit ${totalDebit} vs credit ${totalCredit}.`,
        );
      }

      return { ok: true };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[syncJournal]", msg);
    return { ok: false, error: msg };
  }
}

export class PostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostingError";
  }
}

/** Re-post a batch of ledger entries (used after a bulk approve). */
export async function syncJournalsForEntries(
  companyId: string,
  ledgerEntryIds: string[],
): Promise<SyncResult> {
  for (const id of ledgerEntryIds) {
    const res = await syncJournalForEntry(companyId, id);
    if (!res.ok) return res;
  }
  return { ok: true };
}

/** Drop the journals for ledger entries that are about to be deleted. */
export async function clearJournalsForEntries(
  companyId: string,
  ledgerEntryIds: string[],
): Promise<void> {
  if (ledgerEntryIds.length === 0) return;
  await db
    .delete(journalEntries)
    .where(
      and(
        eq(journalEntries.companyId, companyId),
        inArray(journalEntries.ledgerEntryId, ledgerEntryIds),
      ),
    );
}

export { ensureChart };
