"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { companyMembers, taxPacks } from "@/lib/db/schema";
import { onlyThisCompany, requireWritableTenant } from "@/lib/db/tenant";
import { listTransactions } from "./repo";
import { buildReports } from "./reports";

const CLOSE = "/app/books/close";

/** Record a period close: snapshot the totals into a tax_packs row. */
export async function generateTaxPack() {
  const { company } = await requireWritableTenant();

  const txns = await listTransactions(company.id);
  const reports = buildReports(txns, company.region as "ae" | "gb");

  const periodLabel =
    reports.periodStart && reports.periodEnd
      ? `${reports.periodStart} – ${reports.periodEnd}`
      : new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  try {
    await db.insert(taxPacks).values({
      companyId: company.id,
      periodLabel,
      periodStart: reports.periodStart,
      periodEnd: reports.periodEnd,
      status: "draft",
      totals: {
        revenue: reports.revenue,
        totalExpenses: reports.totalExpenses,
        netProfit: reports.netProfit,
        vatDue: reports.vatDue,
        taxSetAside: reports.withinFreeBand ? 0 : reports.taxSetAside,
        postedCount: reports.postedCount,
        reviewCount: reports.reviewCount,
      },
    });
  } catch (err) {
    console.error("[generateTaxPack]", err instanceof Error ? err.message : err);
    redirect(`${CLOSE}?error=Could+not+close+the+period`);
  }

  revalidatePath(CLOSE);
  redirect(`${CLOSE}?ok=Period+closed+-+pack+ready+to+download`);
}

/** Invite a tax agent (or accountant) to view the books. */
export async function inviteAgent(formData: FormData) {
  const { company, user } = await requireWritableTenant();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "tax_agent");
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!validEmail) redirect(`${CLOSE}?error=Enter+a+valid+email`);
  if (role !== "tax_agent" && role !== "accountant" && role !== "viewer")
    redirect(`${CLOSE}?error=Invalid+role`);

  try {
    // The email is lowercased above, which is what makes the plain-column unique
    // index (company_id, invited_email) a valid conflict target. See the schema.
    await db
      .insert(companyMembers)
      .values({
        companyId: company.id,
        invitedEmail: email,
        role,
        status: "pending",
        invitedBy: user.id,
      })
      .onConflictDoUpdate({
        target: [companyMembers.companyId, companyMembers.invitedEmail],
        set: { role, status: "pending", invitedBy: user.id },
      });
  } catch (err) {
    console.error("[inviteAgent]", err instanceof Error ? err.message : err);
    redirect(`${CLOSE}?error=Could+not+send+the+invite`);
  }

  // The invite is claimed when the INVITEE next signs in — getProfile() calls
  // linkPendingInvites() for them. (The old code called link_my_memberships()
  // here, which ran as the inviter and so could only ever match the inviter's
  // own pending invites; it never did anything for the person being invited.)

  revalidatePath(CLOSE);
  redirect(`${CLOSE}?ok=Invited+${encodeURIComponent(email)}`);
}

export async function revokeAgent(formData: FormData) {
  const { company } = await requireWritableTenant();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${CLOSE}?error=Missing+member`);

  // Scoped to this company: without it, any owner could revoke a membership
  // belonging to another tenant by submitting its id. RLS used to cover this.
  const revoked = await db
    .update(companyMembers)
    .set({ status: "revoked", userId: null })
    .where(onlyThisCompany(companyMembers, company.id, eq(companyMembers.id, id)))
    .returning({ id: companyMembers.id });

  if (revoked.length === 0) {
    redirect(`${CLOSE}?error=Could+not+revoke+access`);
  }

  revalidatePath(CLOSE);
  redirect(`${CLOSE}?ok=Access+revoked`);
}
