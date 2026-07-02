import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CHART, postingLinesFor } from "@/lib/accounting";

// The RLS-bound Supabase client (owner's session). Same shape createClient returns.
type Db = Awaited<ReturnType<typeof createClient>>;

// Insert the default chart of accounts for a company if it has none yet.
// Returns a code -> account-id map. Owner-writable since migration 0008.
async function ensureChart(supabase: Db, companyId: string): Promise<Map<string, string>> {
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

  return new Map(
    ((accounts ?? []) as { id: string; code: string }[]).map((a) => [a.code, a.id]),
  );
}

type LedgerEntryRow = {
  id: string;
  entry_date: string | null;
  description: string | null;
  direction: "income" | "expense";
  category: string;
  amount: number | string;
  vat_amount: number | string;
  status: string;
};

/**
 * Make the posted double-entry journals for ONE ledger entry match its current
 * state, so /app/reports always reflects the currently-approved books:
 *   - always removes any existing journal entry for this ledger line (idempotent),
 *   - if the line is 'approved', posts a fresh balanced journal entry (cash basis).
 * Safe to call after approve, un-approve, or edit. Best-effort: on failure it logs
 * and leaves the line unposted rather than blocking the user's action.
 */
export async function syncJournalForEntry(
  supabase: Db,
  companyId: string,
  ledgerEntryId: string,
): Promise<void> {
  try {
    // Clear any prior journal for this ledger line first.
    await supabase
      .from("journal_entries")
      .delete()
      .eq("company_id", companyId)
      .eq("ledger_entry_id", ledgerEntryId);

    const { data } = await supabase
      .from("ledger_entries")
      .select("id, entry_date, description, direction, category, amount, vat_amount, status")
      .eq("id", ledgerEntryId)
      .eq("company_id", companyId)
      .maybeSingle();

    const e = data as LedgerEntryRow | null;
    if (!e || e.status !== "approved") return;

    const codeToId = await ensureChart(supabase, companyId);
    const lines = postingLinesFor({
      direction: e.direction,
      category: e.category,
      amount: Number(e.amount),
      vat_amount: Number(e.vat_amount),
    });
    const resolved = lines.map((l) => ({
      account_id: codeToId.get(l.code),
      debit: l.debit,
      credit: l.credit,
    }));
    if (resolved.some((l) => !l.account_id)) {
      console.error("[syncJournal] missing account for ledger entry", e.id);
      return;
    }

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
      console.error("[syncJournal] header:", hErr?.message);
      return;
    }

    // All lines in one insert so the deferred balance trigger sees a complete,
    // balanced entry at commit.
    const { error: lErr } = await supabase.from("journal_lines").insert(
      resolved.map((l) => ({
        entry_id: (header as { id: string }).id,
        account_id: l.account_id as string,
        debit: l.debit,
        credit: l.credit,
      })),
    );
    if (lErr) {
      console.error("[syncJournal] lines:", lErr.message);
      await supabase.from("journal_entries").delete().eq("id", (header as { id: string }).id);
    }
  } catch (err) {
    console.error("[syncJournal]", err instanceof Error ? err.message : err);
  }
}
