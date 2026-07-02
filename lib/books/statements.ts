import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  trialBalance,
  profitAndLoss,
  balanceSheet,
  type PostedLine,
  type AccountType,
} from "@/lib/accounting";
import { taxFromLines } from "@/lib/tax";

type JournalLineRow = {
  debit: number | string;
  credit: number | string;
  accounts:
    | { code: string; name: string; type: AccountType }
    | { code: string; name: string; type: AccountType }[]
    | null;
};

/**
 * Load the company's posted journal lines (RLS-scoped to the owner) and derive
 * the full double-entry picture: trial balance, P&L, balance sheet, VAT and
 * corporate tax. Shared by /app and /app/reports so both read one source.
 */
export async function loadStatements(companyId: string) {
  const supabase = await createClient();
  const { data: raw } = await supabase
    .from("journal_lines")
    .select("debit, credit, accounts(code,name,type), journal_entries!inner(company_id)")
    .eq("journal_entries.company_id", companyId);

  const lines: PostedLine[] = ((raw ?? []) as JournalLineRow[])
    .map((r) => {
      const acc = Array.isArray(r.accounts) ? r.accounts[0] : r.accounts;
      if (!acc) return null;
      return {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: Number(r.debit),
        credit: Number(r.credit),
      };
    })
    .filter((x): x is PostedLine => x !== null);

  return {
    lines,
    tb: trialBalance(lines),
    pnl: profitAndLoss(lines),
    bs: balanceSheet(lines),
    tax: taxFromLines(lines),
    hasData: lines.length > 0,
  };
}
