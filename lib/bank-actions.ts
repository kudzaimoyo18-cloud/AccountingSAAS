"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  return { supabase };
}

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
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function importBankCsv(formData: FormData) {
  const { supabase } = await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const csv = String(formData.get("csv") ?? "");
  if (!companyId) redirect("/admin");

  const rows: { company_id: string; txn_date: string; description: string; amount: number }[] = [];
  let skipped = 0;

  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = splitCsv(line);
    if (cells.length < 3) { skipped++; continue; }
    const date = parseDate(cells[0]);
    const amount = parseAmount(cells[cells.length - 1]);
    const description = cells.slice(1, cells.length - 1).join(" ").slice(0, 300);
    // skip a header row gracefully
    if (!date || amount === null) { skipped++; continue; }
    rows.push({ company_id: companyId, txn_date: date, description, amount });
  }

  if (rows.length === 0) {
    redirect(`${bankPath(companyId)}?error=No+valid+rows+found+(use+date,description,amount)`);
  }

  const { error } = await supabase.from("bank_transactions").insert(rows);
  if (error) {
    console.error("[importBankCsv]", error.message);
    redirect(`${bankPath(companyId)}?error=Import+failed`);
  }

  revalidatePath(bankPath(companyId));
  redirect(`${bankPath(companyId)}?ok=${rows.length}+imported${skipped ? `+(${skipped}+skipped)` : ""}`);
}

// Deterministic auto-match: an unmatched bank line matches an unposted-to-bank
// journal entry when the gross amount is equal and the dates are within 7 days.
export async function autoReconcile(formData: FormData) {
  const { supabase } = await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) redirect("/admin");

  const [{ data: bank }, { data: entries }, { data: lines }] = await Promise.all([
    supabase
      .from("bank_transactions")
      .select("id, txn_date, amount")
      .eq("company_id", companyId)
      .eq("status", "unmatched"),
    supabase
      .from("journal_entries")
      .select("id, entry_date")
      .eq("company_id", companyId),
    supabase
      .from("journal_lines")
      .select("entry_id, debit, journal_entries!inner(company_id)")
      .eq("journal_entries.company_id", companyId),
  ]);

  // gross per entry = sum of debits
  const gross = new Map<string, number>();
  for (const l of lines ?? []) {
    gross.set(l.entry_id, (gross.get(l.entry_id) ?? 0) + Number(l.debit));
  }
  const alreadyMatched = new Set(
    (
      await supabase
        .from("bank_transactions")
        .select("matched_entry_id")
        .eq("company_id", companyId)
        .not("matched_entry_id", "is", null)
    ).data?.map((r) => r.matched_entry_id) ?? [],
  );

  const candidates = (entries ?? [])
    .map((e) => ({ id: e.id, date: e.entry_date as string | null, amount: Math.round((gross.get(e.id) ?? 0) * 100) / 100 }))
    .filter((e) => !alreadyMatched.has(e.id));

  const DAY = 86400000;
  let matched = 0;
  for (const b of bank ?? []) {
    const target = Math.abs(Number(b.amount));
    const bt = b.txn_date ? new Date(b.txn_date).getTime() : null;
    const hit = candidates.find(
      (c) =>
        c.amount === target &&
        c.date &&
        bt !== null &&
        Math.abs(new Date(c.date).getTime() - bt) <= 7 * DAY,
    );
    if (!hit) continue;
    const { error } = await supabase
      .from("bank_transactions")
      .update({ matched_entry_id: hit.id, status: "matched" })
      .eq("id", b.id);
    if (!error) {
      matched++;
      candidates.splice(candidates.indexOf(hit), 1); // one-to-one
    }
  }

  revalidatePath(bankPath(companyId));
  redirect(`${bankPath(companyId)}?ok=${matched}+auto-matched`);
}

export async function matchTransaction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const entryId = String(formData.get("entry_id") ?? "");
  if (!companyId || !id || !entryId) redirect(bankPath(companyId));

  const { error } = await supabase
    .from("bank_transactions")
    .update({ matched_entry_id: entryId, status: "matched" })
    .eq("id", id);
  if (error) console.error("[matchTransaction]", error.message);

  revalidatePath(bankPath(companyId));
  redirect(bankPath(companyId));
}

export async function unmatchTransaction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!companyId || !id) redirect(bankPath(companyId));

  const { error } = await supabase
    .from("bank_transactions")
    .update({ matched_entry_id: null, status: "unmatched" })
    .eq("id", id);
  if (error) console.error("[unmatchTransaction]", error.message);

  revalidatePath(bankPath(companyId));
  redirect(bankPath(companyId));
}
