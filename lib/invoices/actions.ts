"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany } from "@/lib/books/repo";
import { syncJournalForEntry } from "@/lib/books/posting";
import { round2 } from "@/lib/accounting";
import { REGIONS } from "@/lib/demo/regions";

const INVOICES = "/app/invoices";
const MAX_LINES = 50;

type Db = Awaited<ReturnType<typeof createClient>>;

/** Session-scoped company — never trust a form-supplied company_id. */
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

/** Same closed-period guard the ledger actions use (fails open on DB error). */
async function isDateInClosedPeriod(
  supabase: Db,
  companyId: string,
  date: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("accounting_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "closed")
    .lte("start_date", date)
    .gte("end_date", date)
    .limit(1);
  if (error) {
    console.error("[invoices/isDateInClosedPeriod]", error.message);
    return false;
  }
  return Boolean(data && data.length > 0);
}

interface DraftLine {
  description: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
}

/** Parse + validate the line editor's JSON payload. Returns null when invalid. */
function parseLines(raw: string, standardVatRate: number): DraftLine[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_LINES) return null;

  const lines: DraftLine[] = [];
  for (const item of parsed) {
    const o = item as Record<string, unknown>;
    const description = String(o.description ?? "").trim().slice(0, 300);
    const qty = Number(o.qty);
    const unitPrice = Number(o.unitPrice);
    const vatRate = Number(o.vatRate);
    if (!description) return null;
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1_000_000) return null;
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100_000_000) return null;
    // Only "no VAT" or the region's standard rate — matches the books engine.
    if (vatRate !== 0 && Math.abs(vatRate - standardVatRate) > 1e-9) return null;
    lines.push({ description, qty, unitPrice, vatRate });
  }
  return lines;
}

export async function createInvoice(formData: FormData) {
  const { supabase, user, company } = await requireCompany();

  const customerId = String(formData.get("customer_id") ?? "");
  const issueDate = String(formData.get("issue_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000);

  if (!customerId) redirect(`${INVOICES}/new?error=Pick+a+customer`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate))
    redirect(`${INVOICES}/new?error=Enter+an+issue+date`);
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
    redirect(`${INVOICES}/new?error=Invalid+due+date`);

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!customer) redirect(`${INVOICES}/new?error=Unknown+customer`);

  const standardVatRate = company.vatRegistered ? REGIONS[company.region].vatRate : 0;
  const lines = parseLines(String(formData.get("lines") ?? ""), standardVatRate);
  if (!lines)
    redirect(`${INVOICES}/new?error=Add+at+least+one+line+with+a+description+and+amount`);

  let subtotal = 0;
  let vatTotal = 0;
  const computed = lines.map((line, index) => {
    const net = round2(line.qty * line.unitPrice);
    const vat = round2(net * line.vatRate);
    subtotal = round2(subtotal + net);
    vatTotal = round2(vatTotal + vat);
    return {
      position: index,
      description: line.description,
      qty: line.qty,
      unit_price: line.unitPrice,
      vat_rate: line.vatRate,
      line_net: net,
      line_vat: vat,
      line_total: round2(net + vat),
    };
  });
  const total = round2(subtotal + vatTotal);
  if (total <= 0) redirect(`${INVOICES}/new?error=Invoice+total+must+be+above+zero`);

  const { data: seq, error: seqErr } = await supabase.rpc("next_invoice_seq", {
    cid: company.id,
  });
  if (seqErr || typeof seq !== "number") {
    console.error("[createInvoice] seq:", seqErr?.message);
    redirect(`${INVOICES}/new?error=Could+not+number+the+invoice`);
  }

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      company_id: company.id,
      customer_id: customerId,
      number: `INV-${String(seq).padStart(4, "0")}`,
      seq,
      issue_date: issueDate,
      due_date: dueDate || null,
      currency: REGIONS[company.region].currency,
      subtotal,
      vat_amount: vatTotal,
      total,
      notes: notes || null,
      share_token: randomBytes(24).toString("base64url"),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (invErr || !invoice) {
    console.error("[createInvoice]", invErr?.message);
    redirect(`${INVOICES}/new?error=Could+not+create+the+invoice`);
  }

  const { error: linesErr } = await supabase
    .from("invoice_lines")
    .insert(computed.map((c) => ({ ...c, invoice_id: invoice.id, company_id: company.id })));

  if (linesErr) {
    console.error("[createInvoice] lines:", linesErr.message);
    await supabase.from("invoices").delete().eq("id", invoice.id);
    redirect(`${INVOICES}/new?error=Could+not+save+the+invoice+lines`);
  }

  revalidatePath(INVOICES, "layout");
  redirect(`${INVOICES}/${invoice.id}?ok=Invoice+created`);
}

export async function markSent(formData: FormData) {
  const { supabase, company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${INVOICES}?error=Missing+invoice`);

  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", company.id)
    .eq("status", "draft");

  if (error) {
    console.error("[markSent]", error.message);
    redirect(`${INVOICES}/${id}?error=Could+not+mark+as+sent`);
  }
  revalidatePath(INVOICES, "layout");
  redirect(`${INVOICES}/${id}?ok=Marked+as+sent+-+share+the+link+with+your+customer`);
}

/**
 * Paid = money in the bank (cash basis): create an approved ledger entry
 * (income · sales_revenue · NET amount) and post its balanced journal via the
 * same engine every other approved line uses, so /app/reports picks it up.
 */
export async function markPaid(formData: FormData) {
  const { supabase, user, company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${INVOICES}?error=Missing+invoice`);

  const { data: invData } = await supabase
    .from("invoices")
    .select("id, number, status, subtotal, vat_amount, currency, customers(name)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!invData) redirect(`${INVOICES}?error=Invoice+not+found`);
  if (invData.status !== "draft" && invData.status !== "sent")
    redirect(`${INVOICES}/${id}?error=Only+draft+or+sent+invoices+can+be+marked+paid`);

  const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v) || 0);
  const subtotal = num(invData.subtotal);
  const vatAmount = num(invData.vat_amount);
  const customerRel = invData.customers as unknown as
    | { name: string }
    | { name: string }[]
    | null;
  const customerName =
    (Array.isArray(customerRel) ? customerRel[0]?.name : customerRel?.name) ?? "Customer";

  const today = new Date().toISOString().slice(0, 10);
  if (await isDateInClosedPeriod(supabase, company.id, today)) {
    redirect(`${INVOICES}/${id}?error=Today+falls+in+a+closed+period+—+reopen+it+first`);
  }

  const { data: entry, error: entryErr } = await supabase
    .from("ledger_entries")
    .insert({
      company_id: company.id,
      entry_date: today,
      description: `Invoice ${invData.number} — ${customerName}`.slice(0, 500),
      counterparty: customerName.slice(0, 200),
      category: "sales_revenue",
      direction: "income",
      currency: invData.currency ?? "AED",
      amount: subtotal, // ledger convention: NET of VAT
      vat_amount: vatAmount,
      source: "manual",
      status: "approved",
      reviewed_by: user.id,
    })
    .select("id")
    .single();

  if (entryErr || !entry) {
    console.error("[markPaid] ledger:", entryErr?.message);
    redirect(`${INVOICES}/${id}?error=Could+not+post+the+payment+to+your+books`);
  }

  const res = await syncJournalForEntry(supabase, company.id, entry.id);
  if (!res.ok) {
    // Never leave an approved line that isn't actually in the books — remove it.
    await supabase.from("ledger_entries").delete().eq("id", entry.id);
    redirect(`${INVOICES}/${id}?error=Could+not+post+this+payment+—+please+retry`);
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString(), ledger_entry_id: entry.id })
    .eq("id", id)
    .eq("company_id", company.id);

  if (error) {
    console.error("[markPaid]", error.message);
    // Roll the posting back so books and invoice status can't disagree.
    await supabase.from("journal_entries").delete().eq("ledger_entry_id", entry.id);
    await supabase.from("ledger_entries").delete().eq("id", entry.id);
    redirect(`${INVOICES}/${id}?error=Could+not+mark+as+paid`);
  }

  revalidatePath(INVOICES, "layout");
  revalidatePath("/app/books/ledger");
  revalidatePath("/app/reports");
  redirect(`${INVOICES}/${id}?ok=Paid+-+posted+to+your+books`);
}

export async function voidInvoice(formData: FormData) {
  const { supabase, company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${INVOICES}?error=Missing+invoice`);

  const { error } = await supabase
    .from("invoices")
    .update({ status: "void" })
    .eq("id", id)
    .eq("company_id", company.id)
    .in("status", ["draft", "sent"]);

  if (error) {
    console.error("[voidInvoice]", error.message);
    redirect(`${INVOICES}/${id}?error=Could+not+void+the+invoice`);
  }
  revalidatePath(INVOICES, "layout");
  redirect(`${INVOICES}/${id}?ok=Invoice+voided`);
}

export async function deleteInvoice(formData: FormData) {
  const { supabase, company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${INVOICES}?error=Missing+invoice`);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("company_id", company.id)
    .eq("status", "draft");

  if (error) {
    console.error("[deleteInvoice]", error.message);
    redirect(`${INVOICES}?error=Could+not+delete+the+draft`);
  }
  revalidatePath(INVOICES, "layout");
  redirect(`${INVOICES}?ok=Draft+deleted`);
}
