"use server";

// Admin-console ledger actions. Same engine as lib/books/ledger-actions.ts, but
// the company is taken from the form (an admin works across tenants) and every
// statement carries an explicit company filter so a stray id cannot cross into
// another tenant's books.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { documents, ledgerEntries } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";
import { getObjectBytes, statObject } from "@/lib/storage";
import { syncJournalForEntry } from "@/lib/books/posting";
import {
  extractLedgerEntries,
  isExtractable,
  LEDGER_CATEGORIES,
  type LedgerCategory,
} from "@/lib/ai";

const DIRECTIONS = ["income", "expense"] as const;
const STATUSES = ["draft", "reviewed", "approved"] as const;

function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function ledgerPath(companyId: string) {
  return `/admin/${companyId}/ledger`;
}

// --- AI: read a document and create draft ledger lines -----------------------
export async function extractDocument(formData: FormData) {
  await requireAdmin();

  const documentId = String(formData.get("document_id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  if (!documentId || !companyId) redirect(ledgerPath(companyId));

  const [doc] = await db
    .select({
      id: documents.id,
      companyId: documents.companyId,
      storagePath: documents.storagePath,
      originalName: documents.originalName,
      kind: documents.kind,
    })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.companyId, companyId)))
    .limit(1);

  if (!doc) {
    redirect(`${ledgerPath(companyId)}?error=Document+not+found`);
  }

  let bytes: Buffer;
  let mediaType: string;
  try {
    const meta = await statObject(doc.storagePath, companyId);
    mediaType = meta?.contentType || "application/octet-stream";
    if (!isExtractable(mediaType)) {
      redirect(`${ledgerPath(companyId)}?error=Unsupported+file+type+for+AI+(use+PDF+or+image)`);
    }
    bytes = await getObjectBytes(doc.storagePath, companyId);
  } catch (err) {
    console.error("[extractDocument] download:", err instanceof Error ? err.message : err);
    redirect(`${ledgerPath(companyId)}?error=Could+not+read+document`);
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
    console.error("[extractDocument] ai:", (e as Error).message);
    redirect(`${ledgerPath(companyId)}?error=AI+extraction+failed`);
  }

  if (extracted.entries.length === 0) {
    redirect(`${ledgerPath(companyId)}?error=No+ledger+lines+found+in+document`);
  }

  const rows = extracted.entries.map((e) => ({
    companyId,
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
      typeof e.confidence === "number" ? String(Math.max(0, Math.min(1, e.confidence))) : null,
    source: "ai" as const,
    status: "draft" as const,
  }));

  try {
    await db.transaction(async (tx) => {
      await tx.insert(ledgerEntries).values(rows);
      // mark the document as processed (same flow as manual processing)
      await tx
        .update(documents)
        .set({ status: "processed" })
        .where(and(eq(documents.id, documentId), eq(documents.companyId, companyId)));
    });
  } catch (err) {
    console.error("[extractDocument] insert:", err instanceof Error ? err.message : err);
    redirect(`${ledgerPath(companyId)}?error=Could+not+save+ledger+lines`);
  }

  revalidatePath(ledgerPath(companyId));
  revalidatePath(`/admin/${companyId}`);
  redirect(`${ledgerPath(companyId)}?ok=${rows.length}+lines+added`);
}

// --- Human review: edit any column on a line ---------------------------------
export async function updateLedgerEntry(formData: FormData) {
  const { user } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  if (!id || !companyId) redirect(ledgerPath(companyId));

  const rawDate = String(formData.get("entry_date") ?? "").trim();
  const direction = String(formData.get("direction") ?? "expense");
  const category = String(formData.get("category") ?? "uncategorised");

  try {
    await db
      .update(ledgerEntries)
      .set({
        entryDate: rawDate || null,
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
        amount: String(num(formData.get("amount"))),
        vatAmount: String(num(formData.get("vat_amount"))),
        reviewedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(ledgerEntries.id, id), eq(ledgerEntries.companyId, companyId)));
  } catch (err) {
    console.error("[updateLedgerEntry]", err instanceof Error ? err.message : err);
  }

  // Keep the posted journals in step with the edit, exactly as the self-serve
  // surface does — otherwise an admin edit would leave Reports showing the old
  // figures for an already-approved line.
  await syncJournalForEntry(companyId, id);

  revalidatePath(ledgerPath(companyId));
  revalidatePath(`/admin/${companyId}/reports`);
  redirect(ledgerPath(companyId));
}

// --- Move a line through draft -> reviewed -> approved -----------------------
export async function setLedgerStatus(formData: FormData) {
  const { user } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect(ledgerPath(companyId));
  }

  try {
    await db
      .update(ledgerEntries)
      .set({ status, reviewedBy: user.id, updatedAt: new Date() })
      .where(and(eq(ledgerEntries.id, id), eq(ledgerEntries.companyId, companyId)));
  } catch (err) {
    console.error("[setLedgerStatus]", err instanceof Error ? err.message : err);
  }

  await syncJournalForEntry(companyId, id);

  revalidatePath(ledgerPath(companyId));
  revalidatePath(`/admin/${companyId}/reports`);
  redirect(ledgerPath(companyId));
}

// --- Add a line by hand ------------------------------------------------------
export async function addLedgerEntry(formData: FormData) {
  await requireAdmin();

  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) redirect("/admin");

  const direction = String(formData.get("direction") ?? "expense");
  const category = String(formData.get("category") ?? "uncategorised");
  const rawDate = String(formData.get("entry_date") ?? "").trim();

  try {
    await db.insert(ledgerEntries).values({
      companyId,
      entryDate: rawDate || null,
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
      amount: String(num(formData.get("amount"))),
      vatAmount: String(num(formData.get("vat_amount"))),
      source: "manual",
      status: "reviewed",
    });
  } catch (err) {
    console.error("[addLedgerEntry]", err instanceof Error ? err.message : err);
    redirect(`${ledgerPath(companyId)}?error=Could+not+add+line`);
  }

  revalidatePath(ledgerPath(companyId));
  redirect(ledgerPath(companyId));
}

export async function deleteLedgerEntry(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  if (!id) redirect(ledgerPath(companyId));

  try {
    await db
      .delete(ledgerEntries)
      .where(and(eq(ledgerEntries.id, id), eq(ledgerEntries.companyId, companyId)));
  } catch (err) {
    console.error("[deleteLedgerEntry]", err instanceof Error ? err.message : err);
  }

  revalidatePath(ledgerPath(companyId));
  revalidatePath(`/admin/${companyId}/reports`);
  redirect(ledgerPath(companyId));
}
