// Server-side data loaders for invoicing. The session-scoped loaders respect
// RLS; getInvoiceByToken uses the service-role client because the public share
// page has no session — the unguessable token is the access control.

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

/** supabase-js types nested relations loosely (object OR array) without
 *  generated DB types — normalise to a single object. */
function rel<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return (value ?? null) as T | null;
}

export async function listInvoices(companyId: string): Promise<InvoiceWithCustomer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, customers(name)")
    .eq("company_id", companyId)
    .order("seq", { ascending: false });

  return ((data as unknown as (InvoiceRow & { customers: unknown })[]) ?? []).map((r) => ({
    ...invoiceFromRow(r),
    customerName: rel<{ name: string }>(r.customers)?.name ?? "—",
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, customers(id, name, email, phone, trn, address), invoice_lines(*)")
    .eq("company_id", companyId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (!data) return null;
  const customer = rel<InvoiceDetail["customer"]>(data.customers);
  if (!customer) return null;

  return {
    invoice: invoiceFromRow(data as unknown as InvoiceRow),
    lines: ((data.invoice_lines as unknown as InvoiceLineRow[]) ?? [])
      .map(lineFromRow)
      .sort((a, b) => a.position - b.position),
    customer,
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

/** Public share-page loader. Token is the only credential — never expose more
 *  than what belongs on the printed invoice. */
export async function getInvoiceByToken(token: string): Promise<PublicInvoice | null> {
  if (!token || token.length < 20) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("invoices")
    .select(
      "*, customers(id, name, email, phone, trn, address), invoice_lines(*), companies(name, trn, free_zone, region)",
    )
    .eq("share_token", token)
    .neq("status", "void")
    .maybeSingle();
  if (!data) return null;
  const customer = rel<InvoiceDetail["customer"]>(data.customers);
  const company = rel<PublicInvoice["company"]>(data.companies);
  if (!customer || !company) return null;

  return {
    invoice: invoiceFromRow(data as unknown as InvoiceRow),
    lines: ((data.invoice_lines as unknown as InvoiceLineRow[]) ?? [])
      .map(lineFromRow)
      .sort((a, b) => a.position - b.position),
    customer,
    company,
  };
}
