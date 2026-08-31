// Server-side data loaders for invoicing.
//
// The session-scoped loaders take an explicit companyId (from requireTenant()).
// getInvoiceByToken is deliberately unscoped: the public share page has no
// session, and the unguessable token IS the access control — so it selects only
// the fields that belong on a printed invoice and refuses short tokens.

import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  companies,
  customers,
  invoiceLines as invoiceLinesTable,
  invoices as invoicesTable,
} from "@/lib/db/schema";
import { onlyThisCompany } from "@/lib/db/tenant";
import {
  invoiceFromRow,
  lineFromRow,
  type Invoice,
  type InvoiceLine,
  type InvoiceRow,
  type InvoiceLineRow,
} from "./types";

export interface InvoiceWithCustomer extends Invoice {
  customerName: string;
}

/** Timestamps come back from the driver as Date; the row types are ISO strings. */
function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

/** Column list aliased to the snake_case shape invoiceFromRow expects. */
const invoiceColumns = {
  id: invoicesTable.id,
  customer_id: invoicesTable.customerId,
  number: invoicesTable.number,
  seq: invoicesTable.seq,
  issue_date: invoicesTable.issueDate,
  due_date: invoicesTable.dueDate,
  currency: invoicesTable.currency,
  status: invoicesTable.status,
  subtotal: invoicesTable.subtotal,
  vat_amount: invoicesTable.vatAmount,
  total: invoicesTable.total,
  notes: invoicesTable.notes,
  share_token: invoicesTable.shareToken,
  sent_at: invoicesTable.sentAt,
  paid_at: invoicesTable.paidAt,
  ledger_entry_id: invoicesTable.ledgerEntryId,
};

const lineColumns = {
  id: invoiceLinesTable.id,
  position: invoiceLinesTable.position,
  description: invoiceLinesTable.description,
  qty: invoiceLinesTable.qty,
  unit_price: invoiceLinesTable.unitPrice,
  vat_rate: invoiceLinesTable.vatRate,
  line_net: invoiceLinesTable.lineNet,
  line_vat: invoiceLinesTable.lineVat,
  line_total: invoiceLinesTable.lineTotal,
};

type RawInvoice = { sent_at: Date | null; paid_at: Date | null } & Omit<
  InvoiceRow,
  "sent_at" | "paid_at"
>;

function toRow(r: RawInvoice): InvoiceRow {
  return { ...r, sent_at: iso(r.sent_at), paid_at: iso(r.paid_at) };
}

export async function listInvoices(companyId: string): Promise<InvoiceWithCustomer[]> {
  const rows = await db
    .select({ ...invoiceColumns, customerName: customers.name })
    .from(invoicesTable)
    .leftJoin(customers, eq(customers.id, invoicesTable.customerId))
    .where(onlyThisCompany(invoicesTable, companyId))
    .orderBy(desc(invoicesTable.seq));

  return rows.map(({ customerName, ...r }) => ({
    ...invoiceFromRow(toRow(r as unknown as RawInvoice)),
    customerName: customerName ?? "—",
  }));
}

export interface InvoiceDetail {
  invoice: Invoice;
  lines: InvoiceLine[];
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    trn: string | null;
    address: string | null;
  };
}

export async function getInvoice(
  companyId: string,
  invoiceId: string,
): Promise<InvoiceDetail | null> {
  const [row] = await db
    .select({
      ...invoiceColumns,
      customerId: customers.id,
      customerName: customers.name,
      customerEmail: customers.email,
      customerPhone: customers.phone,
      customerTrn: customers.trn,
      customerAddress: customers.address,
    })
    .from(invoicesTable)
    .innerJoin(customers, eq(customers.id, invoicesTable.customerId))
    .where(onlyThisCompany(invoicesTable, companyId, eq(invoicesTable.id, invoiceId)))
    .limit(1);

  if (!row) return null;

  const lines = await db
    .select(lineColumns)
    .from(invoiceLinesTable)
    .where(
      and(
        eq(invoiceLinesTable.invoiceId, invoiceId),
        // invoice_lines carries its own company_id, so scope it directly rather
        // than trusting the parent lookup alone.
        eq(invoiceLinesTable.companyId, companyId),
      ),
    );

  return {
    invoice: invoiceFromRow(toRow(row as unknown as RawInvoice)),
    lines: (lines as unknown as InvoiceLineRow[])
      .map(lineFromRow)
      .sort((a, b) => a.position - b.position),
    customer: {
      id: row.customerId,
      name: row.customerName,
      email: row.customerEmail,
      phone: row.customerPhone,
      trn: row.customerTrn,
      address: row.customerAddress,
    },
  };
}

export interface PublicInvoice extends InvoiceDetail {
  company: {
    name: string;
    trn: string | null;
    free_zone: string | null;
    region: "ae" | "gb";
  };
}

/**
 * Public share-page loader. The token is the only credential — never expose more
 * than what belongs on the printed invoice.
 */
export async function getInvoiceByToken(token: string): Promise<PublicInvoice | null> {
  if (!token || token.length < 20) return null;

  const [row] = await db
    .select({
      ...invoiceColumns,
      companyId: invoicesTable.companyId,
      customerId: customers.id,
      customerName: customers.name,
      customerEmail: customers.email,
      customerPhone: customers.phone,
      customerTrn: customers.trn,
      customerAddress: customers.address,
      companyName: companies.name,
      companyTrn: companies.trn,
      companyFreeZone: companies.freeZone,
      companyRegion: companies.region,
    })
    .from(invoicesTable)
    .innerJoin(customers, eq(customers.id, invoicesTable.customerId))
    .innerJoin(companies, eq(companies.id, invoicesTable.companyId))
    .where(and(eq(invoicesTable.shareToken, token), ne(invoicesTable.status, "void")))
    .limit(1);

  if (!row) return null;

  const lines = await db
    .select(lineColumns)
    .from(invoiceLinesTable)
    .where(eq(invoiceLinesTable.invoiceId, row.id));

  return {
    invoice: invoiceFromRow(toRow(row as unknown as RawInvoice)),
    lines: (lines as unknown as InvoiceLineRow[])
      .map(lineFromRow)
      .sort((a, b) => a.position - b.position),
    customer: {
      id: row.customerId,
      name: row.customerName,
      email: row.customerEmail,
      phone: row.customerPhone,
      trn: row.customerTrn,
      address: row.customerAddress,
    },
    company: {
      name: row.companyName,
      trn: row.companyTrn,
      free_zone: row.companyFreeZone,
      region: row.companyRegion as "ae" | "gb",
    },
  };
}

/** Customers for the invoice form's picker. */
export async function listCustomersForPicker(companyId: string) {
  return db
    .select({ id: customers.id, name: customers.name, email: customers.email })
    .from(customers)
    .where(onlyThisCompany(customers, companyId, eq(customers.archived, false)))
    .orderBy(customers.name);
}
