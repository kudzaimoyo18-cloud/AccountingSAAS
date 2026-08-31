import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq, or, sql, type SQL } from "drizzle-orm";
import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "./index";
import { companies, companyMembers, profiles, type Company, type Profile } from "./schema";

// ---------------------------------------------------------------------------
// This module is the replacement for Supabase row-level security.
//
// Under Supabase, every table carried policies keyed on auth.uid(), so a query
// that forgot its company_id filter simply returned nothing. Neon has no
// request-scoped database user, so that safety net is gone and isolation has to
// live here instead.
//
// The rule: user-facing code never touches `db` directly. It calls
// requireTenant() to resolve who is asking and which company they are in, then
// builds every WHERE clause through onlyThisCompany(), which stitches the
// session's company_id into the query. One place to audit, one place to fix.
// ---------------------------------------------------------------------------

/** How the current user reaches the active company. Mirrors the old SQL helpers. */
export type AccessLevel = "owner" | "member" | "admin";

export type Tenant = {
  user: { id: string; email: string; displayName: string | null };
  profile: Profile;
  company: Company;
  companyId: string;
  access: AccessLevel;
  /** owns_company() OR is_admin() in the old policies — members are read-only. */
  canWrite: boolean;
};

/** The signed-in user, or null. Cached per request. */
export const getUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user?.email) return null;
  // Emails are lowercased everywhere: invites are matched on them, and the
  // company_members unique index is a plain-column one.
  return { id: user.id, email: user.email.toLowerCase(), displayName: user.name ?? null };
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Read the caller's profile row, creating it on first sight.
 *
 * Supabase did this with an on_auth_user_created trigger against auth.users.
 * Better Auth owns the `user` table and we keep application data out of it, so
 * the profile is materialised lazily on the first authenticated request.
 */
export const getProfile = cache(async (): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>;
  profile: Profile;
} | null> => {
  const user = await getUser();
  if (!user) return null;

  const [existing] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (existing) {
    // Keep the denormalised email/name fresh when the user changes them.
    if (existing.email !== user.email || existing.fullName !== user.displayName) {
      const [updated] = await db
        .update(profiles)
        .set({ email: user.email, fullName: user.displayName })
        .where(eq(profiles.id, user.id))
        .returning();
      return { user, profile: updated ?? existing };
    }
    return { user, profile: existing };
  }

  const [created] = await db
    .insert(profiles)
    .values({ id: user.id, email: user.email, fullName: user.displayName })
    // Two parallel requests from a brand-new user race here; the loser should
    // read the winner's row rather than blow up with a duplicate key.
    .onConflictDoUpdate({
      target: profiles.id,
      set: { email: user.email, fullName: user.displayName },
    })
    .returning();

  return { user, profile: created };
});

export async function requireProfile() {
  const found = await getProfile();
  if (!found) redirect("/login");
  return found;
}

/**
 * Accept a company invite by its unguessable token.
 *
 * Deliberately NOT keyed on email. The previous version activated any pending
 * invite whose invited_email matched the signed-in address, but sign-up needs
 * no email verification — so registering as someone else's address was enough
 * to be handed read access to their company's books. Possession of the invite
 * link is the credential now, the same model as the public invoice share link.
 *
 * Returns the company id on success, or null when the token is unknown or the
 * invite has already been used or revoked.
 */
export async function acceptInvite(token: string, userId: string): Promise<string | null> {
  if (!token || token.length < 20) return null;

  const [claimed] = await db
    .update(companyMembers)
    .set({ userId, status: "active", acceptedAt: new Date() })
    .where(
      and(
        eq(companyMembers.inviteToken, token),
        eq(companyMembers.status, "pending"),
        sql`${companyMembers.userId} is null`,
      ),
    )
    .returning({ companyId: companyMembers.companyId });

  return claimed?.companyId ?? null;
}

export async function isAdmin(): Promise<boolean> {
  const found = await getProfile();
  return found?.profile.role === "admin";
}

/**
 * The company the caller is currently working in: the one they own, or failing
 * that the first one they were invited to. Returns null when they have neither
 * (a fresh signup that has not been through onboarding).
 */
export const getActiveCompany = cache(async (): Promise<Tenant | null> => {
  const found = await getProfile();
  if (!found) return null;
  const { user, profile } = found;

  const [owned] = await db
    .select()
    .from(companies)
    .where(eq(companies.ownerId, user.id))
    .orderBy(asc(companies.createdAt))
    .limit(1);

  if (owned) {
    return {
      user,
      profile,
      company: owned,
      companyId: owned.id,
      access: "owner",
      canWrite: true,
    };
  }

  // Not an owner — fall back to an active membership (an invited accountant or
  // tax agent). Members can read the books but not write them, matching the old
  // "can_access_company for select, owns_company for write" policy split.
  const [invited] = await db
    .select({ company: companies, role: companyMembers.role })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(and(eq(companyMembers.userId, user.id), eq(companyMembers.status, "active")))
    .orderBy(asc(companies.createdAt))
    .limit(1);

  if (invited) {
    return {
      user,
      profile,
      company: invited.company,
      companyId: invited.company.id,
      access: profile.role === "admin" ? "admin" : "member",
      canWrite: profile.role === "admin",
    };
  }

  return null;
});

/** The tenant for the current request. Redirects out when there is none. */
export async function requireTenant(): Promise<Tenant> {
  const found = await getProfile();
  if (!found) redirect("/login");
  const tenant = await getActiveCompany();
  if (!tenant) redirect("/app/onboarding");
  return tenant;
}

/** requireTenant() plus the old owns_company() write check. */
export async function requireWritableTenant(): Promise<Tenant> {
  const tenant = await requireTenant();
  if (!tenant.canWrite) {
    throw new TenantAccessError("This account has read-only access to these books.");
  }
  return tenant;
}

export class TenantAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantAccessError";
  }
}

/** Any table that carries the tenant key directly. */
type ScopedTable = PgTableWithColumns<TableConfig & { columns: Record<string, never> }>;

/**
 * Build a WHERE clause pinned to one company.
 *
 * This is the single chokepoint that used to be an RLS policy. Every
 * user-facing read and write goes through it:
 *
 *   db.select().from(invoices).where(onlyThisCompany(invoices, tenant, eq(invoices.status, "draft")))
 *
 * Passing a table without a company_id column is a type error, so a table can
 * never quietly slip out of the tenant boundary.
 */
export function onlyThisCompany<T extends { companyId: unknown }>(
  table: T,
  tenant: Tenant | string,
  ...extra: (SQL | undefined)[]
): SQL {
  const companyId = typeof tenant === "string" ? tenant : tenant.companyId;
  const scoped = eq(table.companyId as never, companyId);
  const conditions = [scoped, ...extra.filter(Boolean)] as SQL[];
  return conditions.length === 1 ? scoped : (and(...conditions) as SQL);
}

/**
 * Guard for admin-only, deliberately cross-tenant reads (the /admin console).
 * Everything else must go through requireTenant().
 */
export async function requireAdmin() {
  const found = await getProfile();
  if (!found) redirect("/login");
  if (found.profile.role !== "admin") redirect("/app");
  return found;
}

/**
 * Can this user reach this specific company? Used by routes that take a company
 * id from the URL (the admin console, invite acceptance) rather than the
 * session. Replaces can_access_company().
 */
export async function canAccessCompany(companyId: string): Promise<boolean> {
  const found = await getProfile();
  if (!found) return false;
  if (found.profile.role === "admin") return true;

  const [hit] = await db
    .select({ id: companies.id })
    .from(companies)
    .leftJoin(
      companyMembers,
      and(
        eq(companyMembers.companyId, companies.id),
        eq(companyMembers.userId, found.user.id),
        eq(companyMembers.status, "active"),
      ),
    )
    .where(
      and(
        eq(companies.id, companyId),
        or(eq(companies.ownerId, found.user.id), sql`${companyMembers.id} is not null`),
      ),
    )
    .limit(1);

  return Boolean(hit);
}

export { db };
