"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHART, postingLinesFor } from "@/lib/accounting";

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
  return { supabase, user };
}

function reportsPath(companyId: string) {
  return `/admin/${companyId}/reports`;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Insert the default chart for a company if it has none. Returns code -> id map.
async function ensureChart(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Map<string, string>> {
  const { data: existing } = await supabase
    .from("accounts")
    .select("id, code")
    .eq("company_id", companyId);

  if (!existing || existing.length === 0) {
    await supabase.from("accounts").insert(
      DEFAULT_CHART.map((a) => ({
        company_id: companyId,
        code: a.code,
        name: a.name,
        type: a.type,
        vat_treatment: a.vat_treatment,
      })),
    );
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code")
    .eq("company_id", companyId);

  return new Map((accounts ?? []).map((a) => [a.code, a.id]));
}

export async function seedChartOfAccounts(formData: FormData) {
  const { supabase } = await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) redirect("/admin");

  await ensureChart(supabase, companyId);

  revalidatePath(reportsPath(companyId));
  redirect(`${reportsPath(companyId)}?ok=Chart+of+accounts+ready`);
}

// Post every approved-but-unposted ledger entry as a balanced journal entry.
export async function postApprovedEntries(formData: FormData) {
  const { supabase } = await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) redirect("/admin");

  const codeToId = await ensureChart(supabase, companyId);

  const [{ data: approved }, { data: posted }] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("id, entry_date, description, direction, category, amount, vat_amount")
      .eq("company_id", companyId)
      .eq("status", "approved"),
    supabase
      .from("journal_entries")
      .select("ledger_entry_id")
      .eq("company_id", companyId)
      .not("ledger_entry_id", "is", null),
  ]);

  const alreadyPosted = new Set((posted ?? []).map((p) => p.ledger_entry_id));
  const todo = (approved ?? []).filter((e) => !alreadyPosted.has(e.id));

  let count = 0;
  for (const e of todo) {
    const lines = postingLinesFor({
      direction: e.direction,
      category: e.category,
      amount: Number(e.amount),
      vat_amount: Number(e.vat_amount),
    });

    // resolve account codes -> ids; skip the entry if anything is missing
    const resolved = lines.map((l) => ({ account_id: codeToId.get(l.code), debit: l.debit, credit: l.credit }));
    if (resolved.some((l) => !l.account_id)) {
      console.error("[postApprovedEntries] missing account for ledger", e.id);
      continue;
    }

    // header first (no balance trigger yet) ...
    const { data: header, error: hErr } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        ledger_entry_id: e.id,
        entry_date: e.entry_date ?? new Date().toISOString().slice(0, 10),
        memo: e.description ?? "",
        source: "ledger",
      })
      .select("id")
      .single();

    if (hErr || !header) {
      console.error("[postApprovedEntries] header:", hErr?.message);
      continue;
    }

    // ... then ALL lines in one insert so the deferred balance trigger sees a
    // complete, balanced entry at commit.
    const { error: lErr } = await supabase.from("journal_lines").insert(
      resolved.map((l) => ({
        entry_id: header.id,
        account_id: l.account_id as string,
        debit: l.debit,
        credit: l.credit,
      })),
    );

    if (lErr) {
      console.error("[postApprovedEntries] lines:", lErr.message);
      // roll back the orphan header so a retry can re-post cleanly
      await supabase.from("journal_entries").delete().eq("id", header.id);
      continue;
    }
    count++;
  }

  revalidatePath(reportsPath(companyId));
  redirect(`${reportsPath(companyId)}?ok=${count}+entries+posted`);
}
