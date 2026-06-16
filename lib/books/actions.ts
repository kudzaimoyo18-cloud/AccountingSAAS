"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany, getVendorRules } from "./repo";
import { categorizeLines } from "./categorize";
import { splitVat, REVIEW_THRESHOLD, normalizeMatch } from "./rules";
import { parseCsv, toLines, type ColumnMap } from "./csv";
import { accountByCode } from "@/lib/demo/coa";
import { REGIONS } from "@/lib/demo/regions";
import type { CategorizedLine } from "./categorize";
import type { Direction, RawLine } from "./types";

const BOOKS = "/app/books";
const MAX_IMPORT_ROWS = 1000;

function vatRateFor(vatRegistered: boolean, region: "ae" | "gb"): number {
  return vatRegistered ? REGIONS[region].vatRate : 0;
}

/** Build the DB row payload for one categorised line. */
function toTxnRow(
  companyId: string,
  userId: string,
  line: CategorizedLine,
  importId: string | null,
) {
  const { suggestion } = line;
  const { net, vat } = splitVat(line.amount, suggestion.vatRate);
  const posted = suggestion.confidence >= REVIEW_THRESHOLD;
  return {
    company_id: companyId,
    import_id: importId,
    txn_date: line.date,
    description: line.description.slice(0, 300),
    counterparty: line.counterparty?.slice(0, 200) || null,
    amount: line.amount,
    direction: line.direction,
    account_code: suggestion.accountCode,
    category: suggestion.category,
    vat_rate: suggestion.vatRate,
    vat_amount: vat,
    net_amount: net,
    status: posted ? "posted" : "review",
    confidence: suggestion.confidence,
    source: importId ? (suggestion.source === "ai" ? "ai" : "import") : suggestion.source,
    reason: suggestion.reason,
    created_by: userId,
    posted_at: posted ? new Date().toISOString() : null,
  };
}

// ─────────────────────────── Manual entry ───────────────────────────

export async function addTransaction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const date = String(formData.get("date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const counterparty = String(formData.get("counterparty") ?? "").trim();
  const direction = String(formData.get("direction") ?? "out") as Direction;
  const amount = Math.abs(parseFloat(String(formData.get("amount") ?? "0")));

  if (!date || !description || !Number.isFinite(amount) || amount <= 0) {
    redirect(`${BOOKS}?error=Enter+a+date,+description+and+amount`);
  }
  if (direction !== "in" && direction !== "out") {
    redirect(`${BOOKS}?error=Invalid+direction`);
  }

  const line: RawLine = { date, description, counterparty, amount, direction };
  const vendorRules = await getVendorRules(company.id);
  const [categorized] = await categorizeLines(
    [line],
    company.region,
    vatRateFor(company.vatRegistered, company.region),
    vendorRules,
    Boolean(process.env.ANTHROPIC_API_KEY),
  );

  const { error } = await supabase
    .from("transactions")
    .insert(toTxnRow(company.id, user.id, categorized, null));

  if (error) {
    console.error("[addTransaction]", error.message);
    redirect(`${BOOKS}?error=Could+not+save+the+transaction`);
  }

  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}?ok=Added`);
}

// ─────────────────────────── CSV import ───────────────────────────

export async function importStatement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const file = formData.get("file") as File | null;
  const mappingRaw = String(formData.get("mapping") ?? "");
  if (!file || file.size === 0) redirect(`${BOOKS}/import?error=Choose+a+CSV+file`);
  if (file.size > 5 * 1024 * 1024) redirect(`${BOOKS}/import?error=File+too+large+(max+5MB)`);

  let mapping: ColumnMap;
  try {
    mapping = JSON.parse(mappingRaw) as ColumnMap;
  } catch {
    redirect(`${BOOKS}/import?error=Invalid+column+mapping`);
  }

  const text = await file.text();
  const { rows } = parseCsv(text);
  const lines = toLines(rows, mapping!).slice(0, MAX_IMPORT_ROWS);
  if (lines.length === 0) {
    redirect(`${BOOKS}/import?error=No+rows+found+—+check+the+column+mapping`);
  }

  // Store the raw CSV for audit (best-effort; failure doesn't block import).
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const sourcePath = `${company.id}/statements/${Date.now()}-${safeName}`;
  await supabase.storage.from("documents").upload(sourcePath, file, {
    contentType: file.type || "text/csv",
  });

  const vendorRules = await getVendorRules(company.id);
  const categorized = await categorizeLines(
    lines,
    company.region,
    vatRateFor(company.vatRegistered, company.region),
    vendorRules,
    Boolean(process.env.ANTHROPIC_API_KEY),
  );

  const postedCount = categorized.filter((c) => c.suggestion.confidence >= REVIEW_THRESHOLD).length;
  const reviewCount = categorized.length - postedCount;

  const { data: imp, error: impErr } = await supabase
    .from("statement_imports")
    .insert({
      company_id: company.id,
      uploaded_by: user.id,
      source_name: file.name.slice(0, 200),
      source_path: sourcePath,
      period_label: periodLabel(lines),
      row_count: categorized.length,
      posted_count: postedCount,
      review_count: reviewCount,
    })
    .select("id")
    .single();

  if (impErr || !imp) {
    console.error("[importStatement] batch:", impErr?.message);
    redirect(`${BOOKS}/import?error=Could+not+record+the+import`);
  }

  const payload = categorized.map((line) => toTxnRow(company.id, user.id, line, imp.id));
  const { error: txnErr } = await supabase.from("transactions").insert(payload);
  if (txnErr) {
    console.error("[importStatement] txns:", txnErr.message);
    redirect(`${BOOKS}/import?error=Could+not+save+transactions`);
  }

  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}?ok=Imported+${categorized.length}&review=${reviewCount}`);
}

// ─────────────────────────── Review actions ───────────────────────────

export async function approveTransaction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${BOOKS}/review?error=Missing+transaction`);

  const { error } = await supabase
    .from("transactions")
    .update({ status: "posted", posted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[approveTransaction]", error.message);
    redirect(`${BOOKS}/review?error=Could+not+approve`);
  }
  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}/review`);
}

export async function reassignTransaction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const id = String(formData.get("id") ?? "");
  const accountCode = String(formData.get("account_code") ?? "");
  if (!id || !accountCode) redirect(`${BOOKS}/review?error=Pick+an+account`);

  const account = accountByCode(company.region, accountCode);
  if (!account) redirect(`${BOOKS}/review?error=Unknown+account`);

  // Load the transaction to recompute VAT against its gross amount.
  const { data: txn } = await supabase
    .from("transactions")
    .select("amount, vat_rate, description, counterparty, direction")
    .eq("id", id)
    .single();
  if (!txn) redirect(`${BOOKS}/review?error=Transaction+not+found`);

  const gross = typeof txn.amount === "number" ? txn.amount : parseFloat(txn.amount);
  const vatRate = typeof txn.vat_rate === "number" ? txn.vat_rate : parseFloat(txn.vat_rate);
  const { net, vat } = splitVat(gross, vatRate);

  const { error } = await supabase
    .from("transactions")
    .update({
      account_code: account.code,
      category: account.name,
      net_amount: net,
      vat_amount: vat,
      status: "posted",
      source: "manual",
      posted_at: new Date().toISOString(),
      reason: "approved by you",
    })
    .eq("id", id);

  if (error) {
    console.error("[reassignTransaction]", error.message);
    redirect(`${BOOKS}/review?error=Could+not+re-assign`);
  }

  // Learn: remember this vendor → account so the same payee auto-posts next time.
  const matchText = normalizeMatch(`${txn.description ?? ""} ${txn.counterparty ?? ""}`);
  if (matchText.length >= 3) {
    await supabase.from("vendor_rules").upsert(
      {
        company_id: company.id,
        match_text: matchText,
        account_code: account.code,
        category: account.name,
        vat_rate: vatRate,
        direction: txn.direction,
        created_by: user.id,
      },
      { onConflict: "company_id,match_text" },
    );
  }

  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}/review`);
}

export async function deleteTransaction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${BOOKS}?error=Missing+transaction`);

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) {
    console.error("[deleteTransaction]", error.message);
    redirect(`${BOOKS}?error=Could+not+delete`);
  }
  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}?ok=Deleted`);
}

function periodLabel(lines: RawLine[]): string {
  if (lines.length === 0) return "";
  const dates = lines.map((l) => l.date).sort();
  const first = new Date(dates[0]);
  const month = first.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return month;
}
