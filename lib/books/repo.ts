// Server-side data loaders for the books.
//
// Post-Supabase: identity comes from Clerk (lib/auth), data from Neon via
// Drizzle. RLS is gone, so every query scopes by company_id explicitly — and
// getActiveCompany resolves ONLY companies the caller owns or is an active
// member of (this is the isolation RLS used to enforce).

import { cache } from "react";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { companies, companyMembers, transactions, vendorRules } from "@/lib/db/schema";
import { currentUserId } from "@/lib/auth";
import { type Txn } from "./types";
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

function num(v: number | string | null): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The caller's active company. Resolves a company the Clerk user OWNS, or —
 * failing that — one they are an ACTIVE member of (an invited tax agent).
 * Returns null when signed out or with no accessible company.
 */
export const getActiveCompany = cache(
  async (): Promise<BooksCompany | null> => {
    const userId = await currentUserId();
    if (!userId) return null;

    const [owned] = await db
      .select()
      .from(companies)
      .where(eq(companies.ownerId, userId))
      .orderBy(asc(companies.createdAt))
      .limit(1);

    let row = owned;
    if (!row) {
      const memberCompanyIds = db
        .select({ cid: companyMembers.companyId })
        .from(companyMembers)
        .where(
          and(eq(companyMembers.userId, userId), eq(companyMembers.status, "active")),
        );
      const [member] = await db
        .select()
        .from(companies)
        .where(inArray(companies.id, memberCompanyIds))
        .orderBy(asc(companies.createdAt))
        .limit(1);
      row = member;
    }
    if (!row) return null;

    return toCompany({
      id: row.id,
      name: row.name,
      region: row.region as Region,
      vat_registered: row.vatRegistered,
      free_zone: row.freeZone,
      plan: row.plan,
      status: row.status,
    });
  },
);

// Link any pending company_member invites for this user (e.g. an invited tax
// agent's first visit) by matching their Clerk email. Called once per request
// from the (portal) layout. Replaces the Supabase link_my_memberships() RPC.
export async function linkMemberships(): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  // Only ever match a VERIFIED email. Linking a membership grants access to
  // another company's books, so an unverified address must never satisfy a
  // pending invite (that would let someone claim an invite for an address they
  // don't actually control).
  const emails = user.emailAddresses
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
  if (emails.length === 0) return;

  await db
    .update(companyMembers)
    .set({ userId: user.id, status: "active" })
    .where(
      and(
        isNull(companyMembers.userId),
        eq(companyMembers.status, "pending"),
        inArray(sql`lower(${companyMembers.invitedEmail})`, emails),
      ),
    );
}

export async function listTransactions(companyId: string): Promise<Txn[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.companyId, companyId))
    .orderBy(desc(transactions.txnDate), desc(transactions.createdAt));

  return rows.map((r) => ({
    id: r.id,
    date: r.txnDate,
    description: r.description,
    counterparty: r.counterparty,
    amount: num(r.amount),
    direction: r.direction as Txn["direction"],
    accountCode: r.accountCode,
    category: r.category,
    vatRate: num(r.vatRate),
    vatAmount: num(r.vatAmount),
    net: num(r.netAmount),
    status: r.status as Txn["status"],
    confidence: r.confidence == null ? null : num(r.confidence),
    source: r.source as Txn["source"],
    reason: r.reason,
  }));
}

export async function getVendorRules(companyId: string): Promise<VendorRule[]> {
  const rows = await db
    .select({
      matchText: vendorRules.matchText,
      accountCode: vendorRules.accountCode,
      category: vendorRules.category,
      vatRate: vendorRules.vatRate,
    })
    .from(vendorRules)
    .where(eq(vendorRules.companyId, companyId));

  return rows.map((r) => ({
    matchText: r.matchText,
    accountCode: r.accountCode,
    category: r.category,
    vatRate: num(r.vatRate),
  }));
}

export { toCompany };
export type { CompanyRow };
