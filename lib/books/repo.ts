// Server-side data loaders for the books. All respect RLS via the user's session.

import { createClient } from "@/lib/supabase/server";
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
 * for an invited tax agent (RLS can_access_company scopes the row). First links
 * any pending invites for this user's email, so a freshly-signed-up agent gains
 * access on their first books load.
 */
export async function getActiveCompany(): Promise<BooksCompany | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  await supabase.rpc("link_my_memberships");

  const { data } = await supabase
    .from("companies")
    .select("id, name, region, vat_registered, free_zone, plan, status")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return toCompany(data as CompanyRow);
}

export async function listTransactions(companyId: string): Promise<Txn[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("company_id", companyId)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false });
  return ((data as TxnRow[]) ?? []).map(fromRow);
}

export async function getVendorRules(companyId: string): Promise<VendorRule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_rules")
    .select("match_text, account_code, category, vat_rate")
    .eq("company_id", companyId);
  return (
    (data as { match_text: string; account_code: string; category: string; vat_rate: number | string }[]) ?? []
  ).map((r) => ({
    matchText: r.match_text,
    accountCode: r.account_code,
    category: r.category,
    vatRate: typeof r.vat_rate === "number" ? r.vat_rate : parseFloat(r.vat_rate),
  }));
}

export { toCompany };
export type { CompanyRow };
