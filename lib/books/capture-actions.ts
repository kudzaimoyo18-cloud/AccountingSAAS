"use server";

// Mobile receipt capture: the browser uploads the photo straight to R2 with a
// presigned PUT, then this action receives only the storage KEY, reads the file
// back server-side, runs AI extraction, and lands the user on the review step.
// Keeping the photo out of the action request means Vercel's ~4.5MB function
// body cap can never 413 a capture again. Scoped to the caller's own company
// from the session — the key's company prefix is re-checked on every read.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { documents, ledgerEntries } from "@/lib/db/schema";
import { requireWritableTenant } from "@/lib/db/tenant";
import { assertCompanyKey, getObjectBytes, statObject } from "@/lib/storage";
import {
  extractLedgerEntries,
  isExtractable,
  LEDGER_CATEGORIES,
  type LedgerCategory,
} from "@/lib/ai";

const CAPTURE = "/app/capture";
const DIRECTIONS = ["income", "expense"] as const;
const MAX_BYTES = 15 * 1024 * 1024;

export async function captureReceipt(formData: FormData) {
  const { company, user } = await requireWritableTenant();

  // The browser already uploaded the photo; we only get its storage key.
  // Accept nothing outside the caller's own company prefix.
  const key = String(formData.get("path") ?? "");
  const originalName = String(formData.get("original_name") ?? "").slice(0, 200);
  try {
    assertCompanyKey(key, company.id);
  } catch {
    redirect(`${CAPTURE}?error=No+photo+received`);
  }

  // 1) Confirm the upload actually landed, and check type/size before spending
  //    an AI call on it.
  const meta = await statObject(key, company.id);
  if (!meta) {
    redirect(`${CAPTURE}?error=Could+not+read+the+uploaded+photo+—+try+again`);
  }

  const mediaType =
    meta.contentType || String(formData.get("media_type") ?? "") || "application/octet-stream";
  if (!isExtractable(mediaType)) {
    redirect(`${CAPTURE}?error=That+file+type+is+not+supported`);
  }
  if (meta.size > MAX_BYTES) redirect(`${CAPTURE}?error=Photo+too+large+(max+15MB)`);

  // 2) Record it as a receipt document.
  let docId: string;
  try {
    const [doc] = await db
      .insert(documents)
      .values({
        companyId: company.id,
        uploadedBy: user.id,
        storagePath: key,
        originalName: originalName || "capture",
        kind: "receipt",
      })
      .returning({ id: documents.id });
    if (!doc) throw new Error("insert returned no row");
    docId = doc.id;
  } catch (err) {
    console.error("[capture] db:", err instanceof Error ? err.message : err);
    redirect(`${CAPTURE}?error=Could+not+record+the+photo`);
  }

  // 3) AI-extract straight away so the user reviews on the spot.
  let extracted;
  try {
    const bytes = await getObjectBytes(key, company.id);
    extracted = await extractLedgerEntries({
      data: bytes.toString("base64"),
      mediaType,
      fileName: originalName || "receipt photo",
      docKind: "receipt",
    });
  } catch (e) {
    console.error("[capture] ai:", (e as Error).message);
    // The photo is saved — don't lose it; the user can extract from Documents later.
    redirect(`${CAPTURE}?error=Photo+saved+but+AI+extraction+failed+—+find+it+in+Documents`);
  }

  if (extracted.entries.length === 0) {
    redirect(`${CAPTURE}?doc=${docId!}&warn=No+ledger+lines+found+in+that+photo`);
  }

  const rows = extracted.entries.map((e) => ({
    companyId: company.id,
    documentId: docId!,
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
      await tx
        .update(documents)
        .set({ status: "processed" })
        .where(and(eq(documents.id, docId!), eq(documents.companyId, company.id)));
    });
  } catch (err) {
    console.error("[capture] insert:", err instanceof Error ? err.message : err);
    redirect(`${CAPTURE}?error=Could+not+save+the+drafted+lines`);
  }

  revalidatePath(CAPTURE);
  revalidatePath("/app/books/ledger");
  redirect(`${CAPTURE}?doc=${docId!}`);
}

// Approve (or delete) a drafted line from the capture review screen, staying on
// the capture flow instead of bouncing to the ledger. Wraps the same integrity
// rules by delegating status/posting to the shared ledger actions' logic.
export async function approveCapturedLine(formData: FormData) {
  const { setLedgerStatus } = await import("@/lib/books/ledger-actions");
  formData.set("status", "approved");
  formData.set("next", String(formData.get("next") ?? CAPTURE));
  await setLedgerStatus(formData);
}
