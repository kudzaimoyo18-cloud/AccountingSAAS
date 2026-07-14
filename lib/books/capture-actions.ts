"use server";

// Mobile receipt capture: the browser uploads the photo straight to Supabase
// Storage (RLS scopes writes to the caller's company folder), then this action
// receives only the storage PATH, downloads the file server-side, runs AI
// extraction, and lands the user on the review step. Keeping the photo out of
// the action request means Vercel's ~4.5MB function body cap can never 413 a
// capture again. Scoped to the caller's own company from the session.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveCompany } from "@/lib/books/repo";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  // The browser already uploaded the photo; we only get its storage path.
  // Accept nothing outside the caller's own company folder.
  const path = String(formData.get("path") ?? "");
  const originalName = String(formData.get("original_name") ?? "").slice(0, 200);
  if (!path || !path.startsWith(`${company.id}/`) || path.includes("..")) {
    redirect(`${CAPTURE}?error=No+photo+received`);
  }

  // 1) Pull the photo back out of the private bucket (owner read policy).
  const { data: file, error: dlErr } = await supabase.storage
    .from("documents")
    .download(path);
  if (dlErr || !file) {
    console.error("[capture] download:", dlErr?.message);
    redirect(`${CAPTURE}?error=Could+not+read+the+uploaded+photo+—+try+again`);
  }

  const mediaType =
    file.type || String(formData.get("media_type") ?? "") || "application/octet-stream";
  if (!isExtractable(mediaType)) {
    redirect(`${CAPTURE}?error=That+file+type+is+not+supported`);
  }
  if (file.size > MAX_BYTES) redirect(`${CAPTURE}?error=Photo+too+large+(max+15MB)`);

  // 2) Record it as a receipt document.
  const { data: doc, error: dbErr } = await supabase
    .from("documents")
    .insert({
      company_id: company.id,
      uploaded_by: user.id,
      storage_path: path,
      original_name: originalName || "capture",
      kind: "receipt",
    })
    .select("id")
    .single();
  if (dbErr || !doc) {
    console.error("[capture] db:", dbErr?.message);
    redirect(`${CAPTURE}?error=Could+not+record+the+photo`);
  }

  // 3) AI-extract straight away so the user reviews on the spot.
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  let extracted;
  try {
    extracted = await extractLedgerEntries({
      data: base64,
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
    redirect(`${CAPTURE}?doc=${doc.id}&warn=No+ledger+lines+found+in+that+photo`);
  }

  const admin = createAdminClient();
  const rows = extracted.entries.map((e) => ({
    company_id: company.id,
    document_id: doc.id,
    entry_date: e.entry_date?.trim() ? e.entry_date.trim() : null,
    description: String(e.description ?? "").slice(0, 500),
    counterparty: e.counterparty?.trim() ? e.counterparty.trim().slice(0, 200) : null,
    category: LEDGER_CATEGORIES.includes(e.category as LedgerCategory)
      ? e.category
      : "uncategorised",
    direction: DIRECTIONS.includes(e.direction) ? e.direction : "expense",
    currency: (e.currency || "AED").trim().slice(0, 8).toUpperCase(),
    amount: Number.isFinite(e.amount) ? e.amount : 0,
    vat_amount: Number.isFinite(e.vat_amount) ? e.vat_amount : 0,
    confidence:
      typeof e.confidence === "number" ? Math.max(0, Math.min(1, e.confidence)) : null,
    source: "ai" as const,
    status: "draft" as const,
  }));

  const { error: insErr } = await admin.from("ledger_entries").insert(rows);
  if (insErr) {
    console.error("[capture] insert:", insErr.message);
    redirect(`${CAPTURE}?error=Could+not+save+the+drafted+lines`);
  }

  await admin.from("documents").update({ status: "processed" }).eq("id", doc.id);

  revalidatePath(CAPTURE);
  revalidatePath("/app/books/ledger");
  redirect(`${CAPTURE}?doc=${doc.id}`);
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
