"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractLedgerEntries,
  isExtractable,
  LEDGER_CATEGORIES,
  type LedgerCategory,
} from "@/lib/ai";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/app");
  return { supabase, user };
}

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
  const { supabase, user } = await requireAdmin();

  const documentId = String(formData.get("document_id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  if (!documentId || !companyId) redirect(ledgerPath(companyId));

  const { data: doc } = await supabase
    .from("documents")
    .select("id, company_id, storage_path, original_name, kind")
    .eq("id", documentId)
    .single();

  if (!doc || doc.company_id !== companyId) {
    redirect(`${ledgerPath(companyId)}?error=Document+not+found`);
  }

  // service role can read the private bucket
  const admin = createAdminClient();
  const { data: file, error: dlErr } = await admin.storage
    .from("documents")
    .download(doc.storage_path);

  if (dlErr || !file) {
    console.error("[extractDocument] download:", dlErr?.message);
    redirect(`${ledgerPath(companyId)}?error=Could+not+read+document`);
  }

  const mediaType = file.type || "application/octet-stream";
  if (!isExtractable(mediaType)) {
    redirect(
      `${ledgerPath(companyId)}?error=Unsupported+file+type+for+AI+(use+PDF+or+image)`,
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  let extracted;
  try {
    extracted = await extractLedgerEntries({
      data: base64,
      mediaType,
      fileName: doc.original_name,
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
    company_id: companyId,
    document_id: documentId,
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
      typeof e.confidence === "number"
        ? Math.max(0, Math.min(1, e.confidence))
        : null,
    source: "ai" as const,
    status: "draft" as const,
  }));

  const { error: insErr } = await admin.from("ledger_entries").insert(rows);
  if (insErr) {
    console.error("[extractDocument] insert:", insErr.message);
    redirect(`${ledgerPath(companyId)}?error=Could+not+save+ledger+lines`);
  }

  // mark the document as processed (uses the same flow as manual processing)
  await admin
    .from("documents")
    .update({ status: "processed" })
    .eq("id", documentId);

  void user; // reviewer recorded on edit/approve, not on extract

  revalidatePath(ledgerPath(companyId));
  revalidatePath(`/admin/${companyId}`);
  redirect(`${ledgerPath(companyId)}?ok=${rows.length}+lines+added`);
}

// --- Human review: edit any column on a line ---------------------------------
export async function updateLedgerEntry(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  if (!id || !companyId) redirect(ledgerPath(companyId));

  const rawDate = String(formData.get("entry_date") ?? "").trim();
  const direction = String(formData.get("direction") ?? "expense");
  const category = String(formData.get("category") ?? "uncategorised");

  const { error } = await supabase
    .from("ledger_entries")
    .update({
      entry_date: rawDate || null,
      description: String(formData.get("description") ?? "").slice(0, 500),
      counterparty: String(formData.get("counterparty") ?? "").trim().slice(0, 200) || null,
      category: LEDGER_CATEGORIES.includes(category as LedgerCategory)
        ? category
        : "uncategorised",
      direction: DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])
        ? direction
        : "expense",
      currency: String(formData.get("currency") ?? "AED").trim().slice(0, 8).toUpperCase() || "AED",
      amount: num(formData.get("amount")),
      vat_amount: num(formData.get("vat_amount")),
      reviewed_by: user.id,
    })
    .eq("id", id);

  if (error) console.error("[updateLedgerEntry]", error.message);

  revalidatePath(ledgerPath(companyId));
  redirect(ledgerPath(companyId));
}

// --- Move a line through draft -> reviewed -> approved -----------------------
export async function setLedgerStatus(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect(ledgerPath(companyId));
  }

  const { error } = await supabase
    .from("ledger_entries")
    .update({ status, reviewed_by: user.id })
    .eq("id", id);

  if (error) console.error("[setLedgerStatus]", error.message);

  revalidatePath(ledgerPath(companyId));
  redirect(ledgerPath(companyId));
}

// --- Add a line by hand ------------------------------------------------------
export async function addLedgerEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) redirect("/admin");

  const direction = String(formData.get("direction") ?? "expense");
  const category = String(formData.get("category") ?? "uncategorised");
  const rawDate = String(formData.get("entry_date") ?? "").trim();

  const { error } = await supabase.from("ledger_entries").insert({
    company_id: companyId,
    entry_date: rawDate || null,
    description: String(formData.get("description") ?? "").slice(0, 500),
    counterparty: String(formData.get("counterparty") ?? "").trim().slice(0, 200) || null,
    category: LEDGER_CATEGORIES.includes(category as LedgerCategory)
      ? category
      : "uncategorised",
    direction: DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])
      ? direction
      : "expense",
    currency: String(formData.get("currency") ?? "AED").trim().slice(0, 8).toUpperCase() || "AED",
    amount: num(formData.get("amount")),
    vat_amount: num(formData.get("vat_amount")),
    source: "manual",
    status: "reviewed",
  });

  if (error) {
    console.error("[addLedgerEntry]", error.message);
    redirect(`${ledgerPath(companyId)}?error=Could+not+add+line`);
  }

  revalidatePath(ledgerPath(companyId));
  redirect(ledgerPath(companyId));
}

export async function deleteLedgerEntry(formData: FormData) {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  if (!id) redirect(ledgerPath(companyId));

  const { error } = await supabase.from("ledger_entries").delete().eq("id", id);
  if (error) console.error("[deleteLedgerEntry]", error.message);

  revalidatePath(ledgerPath(companyId));
  redirect(ledgerPath(companyId));
}
