// Invoicing domain types. `subtotal` is net of VAT, `total` is gross — the
// paid-posting keeps the ledger convention (ledger_entries.amount is NET).
// supabase-js returns numeric columns as strings — the fromRow helpers normalise.

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface InvoiceLine {
  id: string;
  position: number;
  description: string;
  qty: number;
  unitPrice: number; // net of VAT
  vatRate: number;
  lineNet: number;
  lineVat: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  number: string;
  seq: number;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  status: InvoiceStatus;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  shareToken: string | null;
  sentAt: string | null;
  paidAt: string | null;
  ledgerEntryId: string | null;
}

export interface InvoiceRow {
  id: string;
  customer_id: string;
  number: string;
  seq: number;
  issue_date: string;
  due_date: string | null;
  currency: string;
  status: InvoiceStatus;
  subtotal: number | string;
  vat_amount: number | string;
  total: number | string;
  notes: string | null;
  share_token: string | null;
  sent_at: string | null;
  paid_at: string | null;
  ledger_entry_id: string | null;
}

export interface InvoiceLineRow {
  id: string;
  position: number;
  description: string;
  qty: number | string;
  unit_price: number | string;
  vat_rate: number | string;
  line_net: number | string;
  line_vat: number | string;
  line_total: number | string;
}

export function invoiceFromRow(r: InvoiceRow): Invoice {
  return {
    id: r.id,
    customerId: r.customer_id,
    number: r.number,
    seq: r.seq,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    currency: r.currency,
    status: r.status,
    subtotal: num(r.subtotal),
    vatAmount: num(r.vat_amount),
    total: num(r.total),
    notes: r.notes,
    shareToken: r.share_token,
    sentAt: r.sent_at,
    paidAt: r.paid_at,
    ledgerEntryId: r.ledger_entry_id,
  };
}

export function lineFromRow(r: InvoiceLineRow): InvoiceLine {
  return {
    id: r.id,
    position: r.position,
    description: r.description,
    qty: num(r.qty),
    unitPrice: num(r.unit_price),
    vatRate: num(r.vat_rate),
    lineNet: num(r.line_net),
    lineVat: num(r.line_vat),
    lineTotal: num(r.line_total),
  };
}

function num(v: number | string): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
