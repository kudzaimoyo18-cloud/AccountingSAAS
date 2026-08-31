"use server";

// Self-serve double-entry ledger actions. Mirror of the admin lib/ledger-actions.ts
// but scoped to the CALLER'S OWN company (resolved from the session, never from a
// form field). Under Supabase the owns_company RLS policies were the backstop;
// on Neon the scoping in requireWritableTenant() + onlyThisCompany() IS the
// enforcement, so every statement here carries its company filter.
// This is what powers /app/books/ledger for the SME owner keeping their own books.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { accountingPeriods, documents, ledgerEntries } from "@/lib/db/schema";
import { onlyThisCompany, requireWritableTenant } from "@/lib/db/tenant";
import { getObjectBytes, statObject } from "@/lib/storage";
import { syncJournalForEntry } from "@/lib/books/posting";
import {
  extractLedgerEntries,
  isExtractable,
  LEDGER_CATEGORIES,
  type LedgerCategory,
} from "@/lib/ai";

const LEDGER = "/app/books/ledger";
const DIRECTIONS = ["income", "expense"] as const;
const STATUSES = ["draft", "reviewed", "approved"] as const;

function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * True if `date` falls inside a CLOSED accounting period for this company. Used
 * to stop edits/approvals/deletes that would silently invalidate a period's
 * snapshotted VAT/CT figures. Fails OPEN (returns false) on a query error so a
 * transient DB hiccup never blocks all bookkeeping.
 */
async function isDateInClosedPeriod(companyId: string, date: string | null): Promise<boolean> {
  if (!date) return false;
  try {
    const rows = await db
      .select({ id: accountingPeriods.id })
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.companyId, companyId),
          eq(accountingPeriods.status, "closed"),
          lte(accountingPeriods.startDate, date),
          gte(accountingPeriods.endDate, date),
        ),
      )
      .limit(1);
    return rows.length > 0;
  } catch (err) {
    console.error("[books/isDateInClosedPeriod]", err instanceof Error ? err.message : err);
    return false;
  }
}

// --- AI: read one of the caller's documents and create draft ledger lines ----
export async function extractDocument(formData: FormData) {
  const { company } = await requireWritableTenant();

  const documentId = String(formData.get("document_id") ?? "");
  if (!documentId) redirect(`${LEDGER}?error=Choose+a+document`);

  const [doc] = await db
    .select({
      id: documents.id,
      companyId: documents.companyId,
      storagePath: documents.storagePath,
      originalName: documents.originalName,
      kind: documents.kind,
    })
    .from(documents)
    .where(onlyThisCompany(documents, company.id, eq(documents.id, documentId)))
    .limit(1);

  if (!doc) redirect(`${LEDGER}?error=Document+not+found`);

  // R2 is private; the key is re-checked against this company's prefix inside
  // getObjectBytes, so a tampered storage_path cannot reach another tenant.
  let bytes: Buffer;
  let mediaType: string;
  try {
    const meta = await statObject(doc.storagePath, company.id);
    mediaType = meta?.contentType || "application/octet-stream";
    if (!isExtractable(mediaType)) {
      redirect(`${LEDGER}?error=Unsupported+file+type+for+AI+(use+PDF+or+image)`);
    }
    bytes = await getObjectBytes(doc.storagePath, company.id);
  } catch (err) {
    console.error("[books/extractDocument] download:", err instanceof Error ? err.message : err);
    redirect(`${LEDGER}?error=Could+not+read+document`);
  }

  let extracted;
  try {
    extracted = await extractLedgerEntries({
      data: bytes!.toString("base64"),
      mediaType: mediaType!,
      fileName: doc.originalName,
      docKind: doc.kind,
    });
  } catch (e) {
    console.error("[books/extractDocument] ai:", (e as Error).message);
    redirect(`${LEDGER}?error=AI+extraction+failed`);
  }

  if (extracted.entries.length === 0) {
    redirect(`${LEDGER}?error=No+ledger+lines+found+in+document`);
  }

  const rows = extracted.entries.map((e) => ({
    companyId: company.id,
    documentId,
    entryDate: e.entry_date?.trim() ? e.entry_date.trim() : null,
    description: String(e.description ?? "").slice(0, 500),
    counterparty: e.counterparty?.trim() ? e.counterparty.trim().slice(0, 200) : null,
    category: LEDGER_CATEGORIES.includes(e.category as LedgerCategory)
      ? e.category
      : "uncategorised",
    direction: DIRECTIONS.includes(e.direction) ? e.direction : "expense",
    currency: (e.currency || "AED").trim().slice(0, 8).toUpperCase(),
    amount: String(Number.isFinite(e.amount) ? e.amount : 0),
    vatAmount: String(Number.isFinite(e.vat_amount) ? e.vat_amount : 0),
    confidence:
      typeof e.confidence === "number"
        ? String(Math.max(0, Math.min(1, e.confidence)))
        : null,
    source: "ai" as const,
    status: "draft" as const,
  }));

  try {
    await db.transaction(async (tx) => {
      await tx.insert(ledgerEntries).values(rows);
      await tx
        .update(documents)
        .set({ status: "processed" })
        .where(and(eq(documents.id, documentId), eq(documents.companyId, company.id)));
    });
  } catch (err) {
    console.error("[books/extractDocument] insert:", err instanceof Error ? err.message : err);
    redirect(`${LEDGER}?error=Could+not+save+ledger+lines`);
  }

  revalidatePath(LEDGER);
  redirect(`${LEDGER}?ok=${rows.length}+lines+added`);
}

// --- Edit any column on one of your own lines --------------------------------
export async function updateLedgerEntry(formData: FormData) {
  const { company, user } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(LEDGER);

  const direction = String(formData.get("direction") ?? "expense");
  const category = String(formData.get("category") ?? "uncategorised");
  const entryDate = String(formData.get("entry_date") ?? "").trim() || null;
  const amount = num(formData.get("amount"));
  const vat = num(formData.get("vat_amount"));

  // Reject values the double-entry engine can't post (a negative amount hits the
  // journal_lines `debit >= 0` constraint and the line would silently unpost).
  if (!(amount > 0)) redirect(`${LEDGER}?error=Amount+must+be+greater+than+zero`);
  if (vat < 0) redirect(`${LEDGER}?error=VAT+cannot+be+negative`);
  if (await isDateInClosedPeriod(company.id, entryDate)) {
    redirect(`${LEDGER}?error=That+date+is+in+a+closed+period`);
  }

  const updated = await db
    .update(ledgerEntries)
    .set({
      entryDate,
      description: String(formData.get("description") ?? "").slice(0, 500),
      counterparty: String(formData.get("counterparty") ?? "").trim().slice(0, 200) || null,
      category: LEDGER_CATEGORIES.includes(category as LedgerCategory)
        ? category
        : "uncategorised",
      direction: DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])
        ? direction
        : "expense",
      currency:
        String(formData.get("currency") ?? "AED").trim().slice(0, 8).toUpperCase() || "AED",
      amount: String(amount),
      vatAmount: String(vat),
      reviewedBy: user.id,
      updatedAt: new Date(),
    })
    .where(onlyThisCompany(ledgerEntries, company.id, eq(ledgerEntries.id, id)))
    .returning({ id: ledgerEntries.id });

  if (updated.length === 0) {
    console.error("[books/updateLedgerEntry] no row updated", id);
    redirect(`${LEDGER}?error=Could+not+save+changes`);
  }

  // Re-post so Reports reflects the edit. If posting fails, tell the user rather
  // than leaving an approved line silently out of the books.
  const res = await syncJournalForEntry(company.id, id);
  revalidatePath(LEDGER);
  revalidatePath("/app/reports");
  if (!res.ok) {
    redirect(`${LEDGER}?error=Saved,+but+could+not+post+to+the+ledger+—+re-approve+to+retry`);
  }
  redirect(LEDGER);
}

// --- Move a line through draft -> reviewed -> approved -----------------------
export async function setLedgerStatus(formData: FormData) {
  const { company, user } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  // Optional return path so mobile flows (e.g. /app/capture) can stay in place
  // after approving. Only same-app relative paths are honoured — never a full
  // URL or protocol-relative path (open-redirect guard).
  const nextRaw = String(formData.get("next") ?? "");
  const back = nextRaw.startsWith("/app") && !nextRaw.startsWith("//") ? nextRaw : LEDGER;
  const backWith = (msg: string) => `${back}${back.includes("?") ? "&" : "?"}${msg}`;

  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect(back);
  }

  // Need the current row: its date (period lock) and its status (to revert to if
  // posting fails after an approve).
  const [prev] = await db
    .select({ entryDate: ledgerEntries.entryDate, status: ledgerEntries.status })
    .from(ledgerEntries)
    .where(onlyThisCompany(ledgerEntries, company.id, eq(ledgerEntries.id, id)))
    .limit(1);

  if (!prev) redirect(back);

  if (await isDateInClosedPeriod(company.id, prev.entryDate)) {
    redirect(backWith("error=That+line+is+in+a+closed+period"));
  }

  const updated = await db
    .update(ledgerEntries)
    .set({ status, reviewedBy: user.id, updatedAt: new Date() })
    .where(onlyThisCompany(ledgerEntries, company.id, eq(ledgerEntries.id, id)))
    .returning({ id: ledgerEntries.id });

  if (updated.length === 0) {
    console.error("[books/setLedgerStatus] no row updated", id);
    redirect(backWith("error=Could+not+update+status"));
  }

  const res = await syncJournalForEntry(company.id, id);
  if (!res.ok && status === "approved") {
    // Never leave an "approved" line that isn't actually in the books — revert.
    await db
      .update(ledgerEntries)
      .set({ status: prev.status, updatedAt: new Date() })
      .where(onlyThisCompany(ledgerEntries, company.id, eq(ledgerEntries.id, id)));
    revalidatePath(LEDGER);
    revalidatePath("/app/reports");
    redirect(backWith("error=Could+not+post+this+line+—+approval+reverted,+please+retry"));
  }

  revalidatePath(LEDGER);
  revalidatePath("/app/capture");
  revalidatePath("/app/reports");
  redirect(back);
}

// --- Add a line by hand ------------------------------------------------------
export async function addLedgerEntry(formData: FormData) {
  const { company } = await requireWritableTenant();

  const direction = String(formData.get("direction") ?? "expense");
  const category = String(formData.get("category") ?? "uncategorised");
  const entryDate = String(formData.get("entry_date") ?? "").trim() || null;
  const amount = num(formData.get("amount"));
  const vat = num(formData.get("vat_amount"));

  if (!(amount > 0)) redirect(`${LEDGER}?error=Amount+must+be+greater+than+zero`);
  if (vat < 0) redirect(`${LEDGER}?error=VAT+cannot+be+negative`);
  if (await isDateInClosedPeriod(company.id, entryDate)) {
    redirect(`${LEDGER}?error=That+date+is+in+a+closed+period`);
  }

  try {
    await db.insert(ledgerEntries).values({
      companyId: company.id,
      entryDate,
      description: String(formData.get("description") ?? "").slice(0, 500),
      counterparty: String(formData.get("counterparty") ?? "").trim().slice(0, 200) || null,
      category: LEDGER_CATEGORIES.includes(category as LedgerCategory)
        ? category
        : "uncategorised",
      direction: DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])
        ? direction
        : "expense",
      currency:
        String(formData.get("currency") ?? "AED").trim().slice(0, 8).toUpperCase() || "AED",
      amount: String(amount),
      vatAmount: String(vat),
      source: "manual",
      status: "reviewed",
    });
  } catch (err) {
    console.error("[books/addLedgerEntry]", err instanceof Error ? err.message : err);
    redirect(`${LEDGER}?error=Could+not+add+line`);
  }

  revalidatePath(LEDGER);
  redirect(`${LEDGER}?ok=Line+added`);
}

export async function deleteLedgerEntry(formData: FormData) {
  const { company } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(LEDGER);

  // Don't let a delete quietly invalidate a closed period's snapshot.
  const [entry] = await db
    .select({ entryDate: ledgerEntries.entryDate })
    .from(ledgerEntries)
    .where(onlyThisCompany(ledgerEntries, company.id, eq(ledgerEntries.id, id)))
    .limit(1);

  if (entry && (await isDateInClosedPeriod(company.id, entry.entryDate))) {
    redirect(`${LEDGER}?error=Cannot+delete+a+line+in+a+closed+period`);
  }

  try {
    // journal_entries.ledger_entry_id cascades, so the posted journal goes with it.
    await db
      .delete(ledgerEntries)
      .where(onlyThisCompany(ledgerEntries, company.id, eq(ledgerEntries.id, id)));
  } catch (err) {
    console.error("[books/deleteLedgerEntry]", err instanceof Error ? err.message : err);
  }

  revalidatePath(LEDGER);
  revalidatePath("/app/reports");
  redirect(LEDGER);
}
