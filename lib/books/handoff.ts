"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany, listTransactions } from "./repo";
import { buildReports } from "./reports";

const CLOSE = "/app/books/close";

/** Record a period close: snapshot the totals into a tax_packs row. */
export async function generateTaxPack() {
  const supabase = await createClient();
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const txns = await listTransactions(company.id);
  const reports = buildReports(txns, company.region);

  const periodLabel =
    reports.periodStart && reports.periodEnd
      ? `${reports.periodStart} – ${reports.periodEnd}`
      : new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  const { error } = await supabase.from("tax_packs").insert({
    company_id: company.id,
    period_label: periodLabel,
    period_start: reports.periodStart,
    period_end: reports.periodEnd,
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

  if (error) {
    console.error("[generateTaxPack]", error.message);
    redirect(`${CLOSE}?error=Could+not+close+the+period`);
  }

  revalidatePath(CLOSE);
  redirect(`${CLOSE}?ok=Period+closed+—+pack+ready+to+download`);
}

/** Invite a tax agent (or accountant) to view the books. */
export async function inviteAgent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "tax_agent");
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!validEmail) redirect(`${CLOSE}?error=Enter+a+valid+email`);
  if (role !== "tax_agent" && role !== "accountant" && role !== "viewer")
    redirect(`${CLOSE}?error=Invalid+role`);

  const { error } = await supabase.from("company_members").upsert(
    {
      company_id: company.id,
      invited_email: email,
      role,
      status: "pending",
      invited_by: user.id,
    },
    { onConflict: "company_id,invited_email" },
  );

  if (error) {
    console.error("[inviteAgent]", error.message);
    redirect(`${CLOSE}?error=Could+not+send+the+invite`);
  }

  // Resolve immediately if that email already has an account.
  await supabase.rpc("link_my_memberships");

  revalidatePath(CLOSE);
  redirect(`${CLOSE}?ok=Invited+${encodeURIComponent(email)}`);
}

export async function revokeAgent(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${CLOSE}?error=Missing+member`);

  const { error } = await supabase
    .from("company_members")
    .update({ status: "revoked", user_id: null })
    .eq("id", id);

  if (error) {
    console.error("[revokeAgent]", error.message);
    redirect(`${CLOSE}?error=Could+not+revoke+access`);
  }
  revalidatePath(CLOSE);
  redirect(`${CLOSE}?ok=Access+revoked`);
}
