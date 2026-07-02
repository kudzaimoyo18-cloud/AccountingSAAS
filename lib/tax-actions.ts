"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { taxFromLines } from "@/lib/tax";
import type { PostedLine, AccountType } from "@/lib/accounting";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/app");
  return { supabase };
}

function taxPath(companyId: string) {
  return `/admin/${companyId}/tax`;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function postedLinesInRange(
  supabase: SupabaseClient,
  companyId: string,
  from: string,
  to: string,
): Promise<PostedLine[]> {
  const { data } = await supabase
    .from("journal_lines")
    .select("debit, credit, accounts(code,name,type), journal_entries!inner(company_id,entry_date)")
    .eq("journal_entries.company_id", companyId)
    .gte("journal_entries.entry_date", from)
    .lte("journal_entries.entry_date", to);

  return (data ?? [])
    .map((r) => {
      const acc = Array.isArray(r.accounts) ? r.accounts[0] : r.accounts;
      if (!acc) return null;
      return {
        code: acc.code as string,
        name: acc.name as string,
        type: acc.type as AccountType,
        debit: Number(r.debit),
        credit: Number(r.credit),
      };
    })
    .filter((x): x is PostedLine => x !== null);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Close a period: snapshot VAT + corporate tax for the range and create draft
// compliance items for the licensed agent to review and file.
export async function closePeriod(formData: FormData) {
  const { supabase } = await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 60) || "Period";
  const from = String(formData.get("from") ?? "").trim();
  const to = String(formData.get("to") ?? "").trim();
  if (!companyId || !from || !to) redirect(`${taxPath(companyId)}?error=Pick+a+date+range`);

  const lines = await postedLinesInRange(supabase, companyId, from, to);
  const { vat, ct } = taxFromLines(lines);

  const { error: pErr } = await supabase.from("accounting_periods").insert({
    company_id: companyId,
    label,
    start_date: from,
    end_date: to,
    status: "closed",
    vat_output: vat.output,
    vat_input: vat.input,
    vat_net: vat.net,
    taxable_profit: ct.taxableProfit,
    corporate_tax: ct.tax,
    closed_at: new Date().toISOString(),
  });
  if (pErr) {
    console.error("[closePeriod] period:", pErr.message);
    redirect(`${taxPath(companyId)}?error=Could+not+close+period`);
  }

  // draft filings → compliance_items (the existing deadline tracker)
  const items = [
    {
      company_id: companyId,
      kind: "vat_return",
      title: `VAT return — ${label}`,
      due_date: addDays(to, 28), // FTA VAT return due 28 days after period end
      status: "upcoming",
      notes: `Auto-computed: output VAT ${vat.output.toFixed(2)} − input VAT ${vat.input.toFixed(2)} = net payable ${vat.net.toFixed(2)} AED. Draft for agent review.`,
    },
    {
      company_id: companyId,
      kind: "corporate_tax",
      title: `Corporate tax — ${label}`,
      due_date: null,
      status: "upcoming",
      notes: `Auto-computed: taxable profit ${ct.taxableProfit.toFixed(2)} AED, 9% over AED ${ct.threshold.toLocaleString()} = ${ct.tax.toFixed(2)} AED. Free-zone qualifying income may be 0% — confirm on review.`,
    },
  ];
  const { error: cErr } = await supabase.from("compliance_items").insert(items);
  if (cErr) console.error("[closePeriod] compliance:", cErr.message);

  revalidatePath(taxPath(companyId));
  revalidatePath(`/admin/${companyId}`);
  redirect(`${taxPath(companyId)}?ok=Period+closed+and+filing+drafts+created`);
}

export async function reopenPeriod(formData: FormData) {
  const { supabase } = await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!companyId || !id) redirect(taxPath(companyId));

  const { error } = await supabase.from("accounting_periods").delete().eq("id", id);
  if (error) console.error("[reopenPeriod]", error.message);

  revalidatePath(taxPath(companyId));
  redirect(`${taxPath(companyId)}?ok=Period+reopened`);
}
