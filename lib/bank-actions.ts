"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { bankTransactions, journalEntries, journalLines } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";

// Admin console: bank import and reconciliation. company_id comes from the form
// because an admin works across tenants; requireAdmin() is the gate. Every write
// still carries its company filter so a stray id cannot touch another tenant.

function bankPath(companyId: string) {
  return `/admin/${companyId}/bank`;
}

// Accepts YYYY-MM-DD or DD/MM/YYYY (or D/M/YYYY).
function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(/[,\s]/g, "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Split a CSV line respecting simple double-quoted fields.
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function importBankCsv(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const csv = String(formData.get("csv") ?? "");
  if (!companyId) redirect("/admin");

  const rows: { companyId: string; txnDate: string; description: string; amount: string }[] = [];
  let skipped = 0;

  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = splitCsv(line);
    if (cells.length < 3) {
      skipped++;
      continue;
    }
    const date = parseDate(cells[0]);
    const amount = parseAmount(cells[cells.length - 1]);
    const description = cells.slice(1, cells.length - 1).join(" ").slice(0, 300);
    // skip a header row gracefully
    if (!date || amount === null) {
      skipped++;
      continue;
    }
    rows.push({ companyId, txnDate: date, description, amount: String(amount) });
  }

  if (rows.length === 0) {
    redirect(`${bankPath(companyId)}?error=No+valid+rows+found+(use+date,description,amount)`);
  }

  try {
    await db.insert(bankTransactions).values(rows);
  } catch (err) {
    console.error("[importBankCsv]", err instanceof Error ? err.message : err);
    redirect(`${bankPath(companyId)}?error=Import+failed`);
  }

  revalidatePath(bankPath(companyId));
  redirect(
    `${bankPath(companyId)}?ok=${rows.length}+imported${skipped ? `+(${skipped}+skipped)` : ""}`,
  );
}

// Deterministic auto-match: an unmatched bank line matches an unposted-to-bank
// journal entry when the gross amount is equal and the dates are within 7 days.
export async function autoReconcile(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) redirect("/admin");

  const [bank, entries, lines, matchedRows] = await Promise.all([
    db
      .select({
        id: bankTransactions.id,
        txnDate: bankTransactions.txnDate,
        amount: bankTransactions.amount,
      })
      .from(bankTransactions)
      .where(
        and(eq(bankTransactions.companyId, companyId), eq(bankTransactions.status, "unmatched")),
      ),
    db
      .select({ id: journalEntries.id, entryDate: journalEntries.entryDate })
      .from(journalEntries)
      .where(eq(journalEntries.companyId, companyId)),
    db
      .select({ entryId: journalLines.entryId, debit: journalLines.debit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(eq(journalEntries.companyId, companyId)),
    db
      .select({ matchedEntryId: bankTransactions.matchedEntryId })
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.companyId, companyId),
          isNotNull(bankTransactions.matchedEntryId),
        ),
      ),
  ]);

  // gross per entry = sum of debits
  const gross = new Map<string, number>();
  for (const l of lines) {
    gross.set(l.entryId, (gross.get(l.entryId) ?? 0) + Number(l.debit));
  }

  const alreadyMatched = new Set(matchedRows.map((r) => r.matchedEntryId));

  const candidates = entries
    .map((e) => ({
      id: e.id,
      date: e.entryDate,
      amount: Math.round((gross.get(e.id) ?? 0) * 100) / 100,
    }))
    .filter((e) => !alreadyMatched.has(e.id));

  const DAY = 86400000;
  let matched = 0;
  for (const b of bank) {
    const target = Math.abs(Number(b.amount));
    const bt = b.txnDate ? new Date(b.txnDate).getTime() : null;
    const hit = candidates.find(
      (c) =>
        c.amount === target &&
        c.date &&
        bt !== null &&
        Math.abs(new Date(c.date).getTime() - bt) <= 7 * DAY,
    );
    if (!hit) continue;

    const updated = await db
      .update(bankTransactions)
      .set({ matchedEntryId: hit.id, status: "matched" })
      .where(and(eq(bankTransactions.id, b.id), eq(bankTransactions.companyId, companyId)))
      .returning({ id: bankTransactions.id });

    if (updated.length > 0) {
      matched++;
      candidates.splice(candidates.indexOf(hit), 1); // one-to-one
    }
  }

  revalidatePath(bankPath(companyId));
  redirect(`${bankPath(companyId)}?ok=${matched}+auto-matched`);
}

export async function matchTransaction(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const entryId = String(formData.get("entry_id") ?? "");
  if (!companyId || !id || !entryId) redirect(bankPath(companyId));

  // Both sides of the match must belong to this company: the journal entry is
  // checked here, the bank line by the WHERE below.
  const [entry] = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.id, entryId), eq(journalEntries.companyId, companyId)))
    .limit(1);

  if (!entry) {
    redirect(`${bankPath(companyId)}?error=That+journal+entry+is+not+in+this+company`);
  }

  try {
    await db
      .update(bankTransactions)
      .set({ matchedEntryId: entryId, status: "matched" })
      .where(and(eq(bankTransactions.id, id), eq(bankTransactions.companyId, companyId)));
  } catch (err) {
    console.error("[matchTransaction]", err instanceof Error ? err.message : err);
  }

  revalidatePath(bankPath(companyId));
  redirect(bankPath(companyId));
}

export async function unmatchTransaction(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!companyId || !id) redirect(bankPath(companyId));

  try {
    await db
      .update(bankTransactions)
      .set({ matchedEntryId: null, status: "unmatched" })
      .where(and(eq(bankTransactions.id, id), eq(bankTransactions.companyId, companyId)));
  } catch (err) {
    console.error("[unmatchTransaction]", err instanceof Error ? err.message : err);
  }

  revalidatePath(bankPath(companyId));
  redirect(bankPath(companyId));
}
