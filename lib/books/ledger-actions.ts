"use server";

// Self-serve double-entry ledger actions. Mirror of the admin lib/ledger-actions.ts
// but scoped to the CALLER'S OWN company (resolved from the session, never from a
// form field) and gated by RLS (owns_company) rather than an admin-role check.
// This is what powers /app/books/ledger for the SME owner keeping their own books.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveCompany } from "@/lib/books/repo";
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

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * True if `date` falls inside a CLOSED accounting period for this company. Used
 * to stop edits/approvals/deletes that would silently invalidate a period's
 * snapshotted VAT/CT figures. Fails OPEN (returns false) on a query error so a
 * transient DB hiccup never blocks all bookkeeping.
 */
async function isDateInClosedPeriod(
  supabase: Db,
  companyId: string,
  date: string | null,
): Promise<boolean> {
  if (!date) return false;
  const { data, error } = await supabase
    .from("accounting_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "closed")
    .lte("start_date", date)
    .gte("end_date", date)
    .limit(1);
  if (error) {
    console.error("[books/isDateInClosedPeriod]", error.message);
    return false;
  }
  return Boolean(data && data.length > 0);
}

/**
 * Resolve the caller's own company. The scope always comes from the session —
 * we never trust a form-supplied company_id (that was fine for the admin surface
 * but would be an IDOR here). Writes are additionally gated by the owns_company
 * RLS policies from migration 0008.
 */
async function requireCompany() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");
  return { supabase, user, company };
}

// --- AI: read one of the caller's documents and create draft ledger lines ----
export async function extractDocument(formData: FormData) {
  const { supabase, company } = await requireCompany();

  const documentId = String(formData.get("document_id") ?? "");
  if (!documentId) redirect(`${LEDGER}?error=Choose+a+document`);

  // RLS scopes documents to the caller's company; the explicit filter is belt
  // and suspenders so we never extract from someone else's file.
  const { data: doc } = await supabase
    .from("documents")
    .select("id, company_id, storage_path, original_name, kind")
    .eq("id", documentId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!doc) redirect(`${LEDGER}?error=Document+not+found`);

  // Service role reads the private bucket.
  const admin = createAdminClient();
  const { data: file, error: dlErr } = await admin.storage
    .from("documents")
    .download(doc.storage_path);
  if (dlErr || !file) {
    console.error("[books/extractDocument] download:", dlErr?.message);
    redirect(`${LEDGER}?error=Could+not+read+document`);
  }

  const mediaType = file.type || "application/octet-stream";
  if (!isExtractable(mediaType)) {
    redirect(`${LEDGER}?error=Unsupported+file+type+for+AI+(use+PDF+or+image)`);
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
    console.error("[books/extractDocument] ai:", (e as Error).message);
    redirect(`${LEDGER}?error=AI+extraction+failed`);
  }

  if (extracted.entries.length === 0) {
    redirect(`${LEDGER}?error=No+ledger+lines+found+in+document`);
  }

  const rows = extracted.entries.map((e) => ({
    company_id: company.id,
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
    console.error("[books/extractDocument] insert:", insErr.message);
    redirect(`${LEDGER}?error=Could+not+save+ledger+lines`);
  }

  await admin
    .from("documents")
    .update({ status: "processed" })
    .eq("id", documentId);

  revalidatePath(LEDGER);
  redirect(`${LEDGER}?ok=${rows.length}+lines+added`);
}

// --- Edit any column on one of your own lines --------------------------------
export async function updateLedgerEntry(formData: FormData) {
  const { supabase, user, company } = await requireCompany();

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
  if (await isDateInClosedPeriod(supabase, company.id, entryDate)) {
    redirect(`${LEDGER}?error=That+date+is+in+a+closed+period`);
  }

  const { error } = await supabase
    .from("ledger_entries")
    .update({
      entry_date: entryDate,
      description: String(formData.get("description") ?? "").slice(0, 500),
      counterparty:
        String(formData.get("counterparty") ?? "").trim().slice(0, 200) || null,
      category: LEDGER_CATEGORIES.includes(category as LedgerCategory)
        ? category
        : "uncategorised",
      direction: DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])
        ? direction
        : "expense",
      currency:
        String(formData.get("currency") ?? "AED").trim().slice(0, 8).toUpperCase() ||
        "AED",
      amount,
      vat_amount: vat,
      reviewed_by: user.id,
    })
    .eq("id", id)
    .eq("company_id", company.id);

  if (error) {
    console.error("[books/updateLedgerEntry]", error.message);
    redirect(`${LEDGER}?error=Could+not+save+changes`);
  }

  // Re-post so Reports reflects the edit. If posting fails, tell the user rather
  // than leaving an approved line silently out of the books.
  const res = await syncJournalForEntry(supabase, company.id, id);
  revalidatePath(LEDGER);
  revalidatePath("/app/reports");
  if (!res.ok) {
    redirect(`${LEDGER}?error=Saved,+but+could+not+post+to+the+ledger+—+re-approve+to+retry`);
  }
  redirect(LEDGER);
}

// --- Move a line through draft -> reviewed -> approved -----------------------
export async function setLedgerStatus(formData: FormData) {
  const { supabase, user, company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  // Optional return path so mobile flows (e.g. /app/capture) can stay in place
  // after approving. Only same-app relative paths are honoured — never a full
  // URL or protocol-relative path (open-redirect guard).
  const nextRaw = String(formData.get("next") ?? "");
  const back =
    nextRaw.startsWith("/app") && !nextRaw.startsWith("//") ? nextRaw : LEDGER;
  const backWith = (msg: string) =>
    `${back}${back.includes("?") ? "&" : "?"}${msg}`;

  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect(back);
  }

  // Need the current row: its date (period lock) and its status (to revert to if
  // posting fails after an approve).
  const { data: entry } = await supabase
    .from("ledger_entries")
    .select("entry_date, status")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!entry) redirect(back);
  const prev = entry as { entry_date: string | null; status: string };

  if (await isDateInClosedPeriod(supabase, company.id, prev.entry_date)) {
    redirect(backWith("error=That+line+is+in+a+closed+period"));
  }

  const { error } = await supabase
    .from("ledger_entries")
    .update({ status, reviewed_by: user.id })
    .eq("id", id)
    .eq("company_id", company.id);
  if (error) {
    console.error("[books/setLedgerStatus]", error.message);
    redirect(backWith("error=Could+not+update+status"));
  }

  const res = await syncJournalForEntry(supabase, company.id, id);
  if (!res.ok && status === "approved") {
    // Never leave an "approved" line that isn't actually in the books — revert.
    await supabase
      .from("ledger_entries")
      .update({ status: prev.status })
      .eq("id", id)
      .eq("company_id", company.id);
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
  const { supabase, company } = await requireCompany();

  const direction = String(formData.get("direction") ?? "expense");
  const category = String(formData.get("category") ?? "uncategorised");
  const entryDate = String(formData.get("entry_date") ?? "").trim() || null;
  const amount = num(formData.get("amount"));
  const vat = num(formData.get("vat_amount"));

  if (!(amount > 0)) redirect(`${LEDGER}?error=Amount+must+be+greater+than+zero`);
  if (vat < 0) redirect(`${LEDGER}?error=VAT+cannot+be+negative`);
  if (await isDateInClosedPeriod(supabase, company.id, entryDate)) {
    redirect(`${LEDGER}?error=That+date+is+in+a+closed+period`);
  }

  const { error } = await supabase.from("ledger_entries").insert({
    company_id: company.id,
    entry_date: entryDate,
    description: String(formData.get("description") ?? "").slice(0, 500),
    counterparty:
      String(formData.get("counterparty") ?? "").trim().slice(0, 200) || null,
    category: LEDGER_CATEGORIES.includes(category as LedgerCategory)
      ? category
      : "uncategorised",
    direction: DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])
      ? direction
      : "expense",
    currency:
      String(formData.get("currency") ?? "AED").trim().slice(0, 8).toUpperCase() ||
      "AED",
    amount,
    vat_amount: vat,
    source: "manual",
    status: "reviewed",
  });

  if (error) {
    console.error("[books/addLedgerEntry]", error.message);
    redirect(`${LEDGER}?error=Could+not+add+line`);
  }

  revalidatePath(LEDGER);
  redirect(`${LEDGER}?ok=Line+added`);
}

export async function deleteLedgerEntry(formData: FormData) {
  const { supabase, company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(LEDGER);

  // Don't let a delete quietly invalidate a closed period's snapshot.
  const { data: entry } = await supabase
    .from("ledger_entries")
    .select("entry_date")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (
    entry &&
    (await isDateInClosedPeriod(supabase, company.id, (entry as { entry_date: string | null }).entry_date))
  ) {
    redirect(`${LEDGER}?error=Cannot+delete+a+line+in+a+closed+period`);
  }

  const { error } = await supabase
    .from("ledger_entries")
    .delete()
    .eq("id", id)
    .eq("company_id", company.id);

  if (error) console.error("[books/deleteLedgerEntry]", error.message);

  revalidatePath(LEDGER);
  revalidatePath("/app/reports");
  redirect(LEDGER);
}
