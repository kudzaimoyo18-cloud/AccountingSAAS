"use server";

// Mobile receipt capture: one action that takes a camera photo, stores it as a
// document, runs AI extraction, and lands the user on the review step — the
// whole snap → draft → approve loop with a single submit. Reuses the exact
// storage/extraction path of /app/documents + /app/books/ledger; scoped to the
// caller's own company from the session (never a form field).

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
// Vercel Functions accept request bodies up to 4.5 MB. Leave room for the
// multipart form envelope so the request reaches this Server Action reliably.
const MAX_BYTES = 4 * 1024 * 1024;

export async function captureReceipt(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) redirect(`${CAPTURE}?error=No+photo+received`);
  if (file.size > MAX_BYTES) redirect(`${CAPTURE}?error=Photo+too+large+(max+4MB)`);

  const mediaType = file.type || "application/octet-stream";
  if (!isExtractable(mediaType)) {
    redirect(`${CAPTURE}?error=That+file+type+is+not+supported`);
  }

  // 1) Store the photo in the same private bucket the Documents page uses.
  const ext = mediaType === "image/png" ? "png" : mediaType === "application/pdf" ? "pdf" : "jpg";
  const path = `${company.id}/${Date.now()}-capture.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: mediaType });
  if (upErr) {
    console.error("[capture] storage:", upErr.message);
    redirect(`${CAPTURE}?error=Upload+failed+—+try+again`);
  }

  // 2) Record it as a receipt document.
  const { data: doc, error: dbErr } = await supabase
    .from("documents")
    .insert({
      company_id: company.id,
      uploaded_by: user.id,
      storage_path: path,
      original_name: file.name?.slice(0, 200) || `capture.${ext}`,
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
      fileName: file.name || "receipt photo",
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
