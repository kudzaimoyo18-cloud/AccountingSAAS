"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  accountingPeriods,
  companies,
  customers,
  invoiceLines,
  invoices,
  ledgerEntries,
} from "@/lib/db/schema";
import { onlyThisCompany, requireWritableTenant } from "@/lib/db/tenant";
import { syncJournalForEntry } from "@/lib/books/posting";
import { round2 } from "@/lib/accounting";
import { REGIONS } from "@/lib/demo/regions";

const INVOICES = "/app/invoices";
const MAX_LINES = 50;

/** Same closed-period guard the ledger actions use (fails open on DB error). */
async function isDateInClosedPeriod(companyId: string, date: string): Promise<boolean> {
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
    console.error("[invoices/isDateInClosedPeriod]", err instanceof Error ? err.message : err);
    return false;
  }
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
  const { company, user } = await requireWritableTenant();

  const customerId = String(formData.get("customer_id") ?? "");
  const issueDate = String(formData.get("issue_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000);

  if (!customerId) redirect(`${INVOICES}/new?error=Pick+a+customer`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate))
    redirect(`${INVOICES}/new?error=Enter+an+issue+date`);
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
    redirect(`${INVOICES}/new?error=Invalid+due+date`);

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(onlyThisCompany(customers, company.id, eq(customers.id, customerId)))
    .limit(1);
  if (!customer) redirect(`${INVOICES}/new?error=Unknown+customer`);

  const region = company.region as "ae" | "gb";
  const standardVatRate = company.vatRegistered ? REGIONS[region].vatRate : 0;
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
      qty: String(line.qty),
      unitPrice: String(line.unitPrice),
      vatRate: String(line.vatRate),
      lineNet: String(net),
      lineVat: String(vat),
      lineTotal: String(round2(net + vat)),
    };
  });
  const total = round2(subtotal + vatTotal);
  if (total <= 0) redirect(`${INVOICES}/new?error=Invoice+total+must+be+above+zero`);

  let invoiceId: string;
  try {
    invoiceId = await db.transaction(async (tx) => {
      // Atomic per-company invoice number. This replaces the next_invoice_seq()
      // SQL function: the UPDATE ... RETURNING takes a row lock, so two
      // concurrent invoices can never be handed the same sequence, and it is in
      // the same transaction as the insert so a failed invoice does not burn a
      // number.
      const [counter] = await tx
        .update(companies)
        .set({ invoiceCounter: sql`${companies.invoiceCounter} + 1` })
        .where(eq(companies.id, company.id))
        .returning({ seq: companies.invoiceCounter });

      if (!counter) throw new Error("Could not number the invoice.");
      const seq = counter.seq;

      const [invoice] = await tx
        .insert(invoices)
        .values({
          companyId: company.id,
          customerId,
          number: `INV-${String(seq).padStart(4, "0")}`,
          seq,
          issueDate,
          dueDate: dueDate || null,
          currency: REGIONS[region].currency,
          subtotal: String(subtotal),
          vatAmount: String(vatTotal),
          total: String(total),
          notes: notes || null,
          shareToken: randomBytes(24).toString("base64url"),
          createdBy: user.id,
        })
        .returning({ id: invoices.id });

      if (!invoice) throw new Error("Could not create the invoice.");

      await tx
        .insert(invoiceLines)
        .values(computed.map((c) => ({ ...c, invoiceId: invoice.id, companyId: company.id })));

      return invoice.id;
    });
  } catch (err) {
    console.error("[createInvoice]", err instanceof Error ? err.message : err);
    redirect(`${INVOICES}/new?error=Could+not+create+the+invoice`);
  }

  revalidatePath(INVOICES, "layout");
  redirect(`${INVOICES}/${invoiceId!}?ok=Invoice+created`);
}

export async function markSent(formData: FormData) {
  const { company } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${INVOICES}?error=Missing+invoice`);

  const updated = await db
    .update(invoices)
    .set({ status: "sent", sentAt: new Date() })
    .where(
      onlyThisCompany(invoices, company.id, eq(invoices.id, id), eq(invoices.status, "draft")),
    )
    .returning({ id: invoices.id });

  if (updated.length === 0) {
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
  const { company, user } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${INVOICES}?error=Missing+invoice`);

  const [inv] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      subtotal: invoices.subtotal,
      vatAmount: invoices.vatAmount,
      currency: invoices.currency,
      customerName: customers.name,
    })
    .from(invoices)
    .leftJoin(customers, eq(customers.id, invoices.customerId))
    .where(onlyThisCompany(invoices, company.id, eq(invoices.id, id)))
    .limit(1);

  if (!inv) redirect(`${INVOICES}?error=Invoice+not+found`);
  if (inv.status !== "draft" && inv.status !== "sent")
    redirect(`${INVOICES}/${id}?error=Only+draft+or+sent+invoices+can+be+marked+paid`);

  const subtotal = Number(inv.subtotal) || 0;
  const vatAmount = Number(inv.vatAmount) || 0;
  const customerName = inv.customerName ?? "Customer";

  const today = new Date().toISOString().slice(0, 10);
  if (await isDateInClosedPeriod(company.id, today)) {
    redirect(`${INVOICES}/${id}?error=Today+falls+in+a+closed+period+—+reopen+it+first`);
  }

  // The ledger entry and the invoice's paid status commit together. Under
  // Supabase these were separate calls with hand-rolled compensating deletes;
  // one transaction means the books and the invoice can never disagree.
  let entryId: string;
  try {
    entryId = await db.transaction(async (tx) => {
      const [entry] = await tx
        .insert(ledgerEntries)
        .values({
          companyId: company.id,
          entryDate: today,
          description: `Invoice ${inv.number} — ${customerName}`.slice(0, 500),
          counterparty: customerName.slice(0, 200),
          category: "sales_revenue",
          direction: "income",
          currency: inv.currency ?? "AED",
          amount: String(subtotal), // ledger convention: NET of VAT
          vatAmount: String(vatAmount),
          source: "manual",
          status: "approved",
          reviewedBy: user.id,
        })
        .returning({ id: ledgerEntries.id });

      if (!entry) throw new Error("Could not create the ledger entry.");

      const marked = await tx
        .update(invoices)
        .set({ status: "paid", paidAt: new Date(), ledgerEntryId: entry.id })
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.companyId, company.id),
            inArray(invoices.status, ["draft", "sent"]),
          ),
        )
        .returning({ id: invoices.id });

      // Someone else marked it paid (or voided it) between the read and here.
      if (marked.length === 0) throw new Error("Invoice status changed — please reload.");

      return entry.id;
    });
  } catch (err) {
    console.error("[markPaid]", err instanceof Error ? err.message : err);
    redirect(`${INVOICES}/${id}?error=Could+not+post+the+payment+to+your+books`);
  }

  // Post the double entry. Journals live in their own transaction, so if this
  // fails the approved line is rolled back to keep Reports honest.
  const res = await syncJournalForEntry(company.id, entryId!);
  if (!res.ok) {
    await db.transaction(async (tx) => {
      await tx
        .update(invoices)
        .set({ status: "sent", paidAt: null, ledgerEntryId: null })
        .where(and(eq(invoices.id, id), eq(invoices.companyId, company.id)));
      await tx
        .delete(ledgerEntries)
        .where(
          and(eq(ledgerEntries.id, entryId!), eq(ledgerEntries.companyId, company.id)),
        );
    });
    redirect(`${INVOICES}/${id}?error=Could+not+post+this+payment+—+please+retry`);
  }

  revalidatePath(INVOICES, "layout");
  revalidatePath("/app/books/ledger");
  revalidatePath("/app/reports");
  redirect(`${INVOICES}/${id}?ok=Paid+-+posted+to+your+books`);
}

export async function voidInvoice(formData: FormData) {
  const { company } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${INVOICES}?error=Missing+invoice`);

  const updated = await db
    .update(invoices)
    .set({ status: "void" })
    .where(
      onlyThisCompany(
        invoices,
        company.id,
        eq(invoices.id, id),
        inArray(invoices.status, ["draft", "sent"]),
      ),
    )
    .returning({ id: invoices.id });

  if (updated.length === 0) {
    redirect(`${INVOICES}/${id}?error=Could+not+void+the+invoice`);
  }

  revalidatePath(INVOICES, "layout");
  redirect(`${INVOICES}/${id}?ok=Invoice+voided`);
}

export async function deleteInvoice(formData: FormData) {
  const { company } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${INVOICES}?error=Missing+invoice`);

  const deleted = await db
    .delete(invoices)
    .where(
      onlyThisCompany(invoices, company.id, eq(invoices.id, id), eq(invoices.status, "draft")),
    )
    .returning({ id: invoices.id });

  if (deleted.length === 0) {
    redirect(`${INVOICES}?error=Could+not+delete+the+draft`);
  }

  revalidatePath(INVOICES, "layout");
  redirect(`${INVOICES}?ok=Draft+deleted`);
}
