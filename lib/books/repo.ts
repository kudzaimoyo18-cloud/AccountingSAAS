// Server-side data loaders for the books.
//
// Tenancy note: these used to lean on Supabase RLS, which silently scoped every
// query to the caller. On Neon there is no such net, so each loader takes an
// explicit companyId and filters through onlyThisCompany(). Callers get that id
// from requireTenant(), never from a form field or URL.

import { cache } from "react";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  companies,
  transactions as txnTable,
  vendorRules as vendorRulesTable,
} from "@/lib/db/schema";
import {
  getActiveCompany as getTenant,
  linkPendingInvites,
  onlyThisCompany,
  getProfile,
} from "@/lib/db/tenant";
import { fromRow, type Txn, type TxnRow } from "./types";
import type { VendorRule } from "./categorize";
import type { Region } from "@/lib/demo/types";

export interface BooksCompany {
  id: string;
  name: string;
  region: Region;
  vatRegistered: boolean;
  freeZone: string | null;
  plan: string;
  status: string;
}

interface CompanyRow {
  id: string;
  name: string;
  region: Region;
  vat_registered: boolean;
  free_zone: string | null;
  plan: string;
  status: string;
}

function toCompany(r: CompanyRow): BooksCompany {
  return {
    id: r.id,
    name: r.name,
    region: r.region,
    vatRegistered: r.vat_registered,
    freeZone: r.free_zone,
    plan: r.plan,
    status: r.status,
  };
}

/**
 * The caller's active company, mapped into books shape. Works for the owner AND
 * for an invited tax agent — requireTenant()/getActiveCompany() resolves owned
 * companies first, then active memberships.
 *
 * Cached per request: the (portal) layout and the page both call this, so it
 * resolves to one lookup per navigation.
 */
export const getActiveCompany = cache(async (): Promise<BooksCompany | null> => {
  const tenant = await getTenant();
  if (!tenant) return null;
  const c = tenant.company;
  return {
    id: c.id,
    name: c.name,
    region: c.region as Region,
    vatRegistered: c.vatRegistered,
    freeZone: c.freeZone,
    plan: c.plan,
    status: c.status,
  };
});

/**
 * Claim any pending company_member invites addressed to this user's email (an
 * invited tax agent's first visit). Called once per request from the (portal)
 * layout. Replaces the old link_my_memberships() SQL function.
 */
export async function linkMemberships(): Promise<void> {
  const found = await getProfile();
  if (!found) return;
  await linkPendingInvites(found.user.id, found.user.email);
}

/**
 * Every transaction for one company, newest first.
 *
 * The select is written out column by column, aliased back to the database's
 * snake_case names, so TxnRow and everything downstream of fromRow() keeps the
 * exact shape it had under supabase-js. numeric columns still arrive as strings
 * from the driver, which is what fromRow() already expects.
 */
export async function listTransactions(companyId: string): Promise<Txn[]> {
  const rows = await db
    .select({
      id: txnTable.id,
      txn_date: txnTable.txnDate,
      description: txnTable.description,
      counterparty: txnTable.counterparty,
      amount: txnTable.amount,
      direction: txnTable.direction,
      account_code: txnTable.accountCode,
      category: txnTable.category,
      vat_rate: txnTable.vatRate,
      vat_amount: txnTable.vatAmount,
      net_amount: txnTable.netAmount,
      status: txnTable.status,
      confidence: txnTable.confidence,
      source: txnTable.source,
      reason: txnTable.reason,
    })
    .from(txnTable)
    .where(onlyThisCompany(txnTable, companyId))
    .orderBy(desc(txnTable.txnDate), desc(txnTable.createdAt));

  return (rows as unknown as TxnRow[]).map(fromRow);
}

export async function getVendorRules(companyId: string): Promise<VendorRule[]> {
  const rows = await db
    .select({
      matchText: vendorRulesTable.matchText,
      accountCode: vendorRulesTable.accountCode,
      category: vendorRulesTable.category,
      vatRate: vendorRulesTable.vatRate,
    })
    .from(vendorRulesTable)
    .where(onlyThisCompany(vendorRulesTable, companyId));

  return rows.map((r) => ({
    matchText: r.matchText,
    accountCode: r.accountCode,
    category: r.category,
    vatRate: typeof r.vatRate === "number" ? r.vatRate : parseFloat(r.vatRate),
  }));
}

/** Look up one company by id without the session shortcut (admin console). */
export async function getCompanyById(companyId: string): Promise<BooksCompany | null> {
  const [row] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    region: row.region as Region,
    vatRegistered: row.vatRegistered,
    freeZone: row.freeZone,
    plan: row.plan,
    status: row.status,
  };
}

export { toCompany };
export type { CompanyRow };
