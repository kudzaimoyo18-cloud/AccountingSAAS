"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  accounts,
  accountingPeriods,
  complianceItems,
  journalEntries,
  journalLines,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";
import { taxFromLines } from "@/lib/tax";
import type { PostedLine, AccountType } from "@/lib/accounting";

function taxPath(companyId: string) {
  return `/admin/${companyId}/tax`;
}

async function postedLinesInRange(
  companyId: string,
  from: string,
  to: string,
): Promise<PostedLine[]> {
  const rows = await db
    .select({
      debit: journalLines.debit,
      credit: journalLines.credit,
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(
      and(
        eq(journalEntries.companyId, companyId),
        gte(journalEntries.entryDate, from),
        lte(journalEntries.entryDate, to),
      ),
    );

  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    type: r.type as AccountType,
    debit: Number(r.debit),
    credit: Number(r.credit),
  }));
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Close a period: snapshot VAT + corporate tax for the range and create draft
// compliance items for the licensed agent to review and file.
export async function closePeriod(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const label = String(formData.get("label") ?? "").trim().slice(0, 60) || "Period";
  const from = String(formData.get("from") ?? "").trim();
  const to = String(formData.get("to") ?? "").trim();
  if (!companyId || !from || !to) redirect(`${taxPath(companyId)}?error=Pick+a+date+range`);

  const lines = await postedLinesInRange(companyId, from, to);
  const { vat, ct } = taxFromLines(lines);

  try {
    // The period snapshot and its draft filings land together: a closed period
    // with no filings to act on is a silent compliance gap.
    await db.transaction(async (tx) => {
      await tx.insert(accountingPeriods).values({
        companyId,
        label,
        startDate: from,
        endDate: to,
        status: "closed",
        vatOutput: String(vat.output),
        vatInput: String(vat.input),
        vatNet: String(vat.net),
        taxableProfit: String(ct.taxableProfit),
        corporateTax: String(ct.tax),
        closedAt: new Date(),
      });

      await tx.insert(complianceItems).values([
        {
          companyId,
          kind: "vat_return",
          title: `VAT return — ${label}`,
          dueDate: addDays(to, 28), // FTA VAT return due 28 days after period end
          status: "upcoming",
          notes: `Auto-computed: output VAT ${vat.output.toFixed(2)} − input VAT ${vat.input.toFixed(2)} = net payable ${vat.net.toFixed(2)} AED. Draft for agent review.`,
        },
        {
          companyId,
          kind: "corporate_tax",
          title: `Corporate tax — ${label}`,
          dueDate: null,
          status: "upcoming",
          notes: `Auto-computed: taxable profit ${ct.taxableProfit.toFixed(2)} AED, 9% over AED ${ct.threshold.toLocaleString()} = ${ct.tax.toFixed(2)} AED. Free-zone qualifying income may be 0% — confirm on review.`,
        },
      ]);
    });
  } catch (err) {
    console.error("[closePeriod]", err instanceof Error ? err.message : err);
    redirect(`${taxPath(companyId)}?error=Could+not+close+period`);
  }

  revalidatePath(taxPath(companyId));
  revalidatePath(`/admin/${companyId}`);
  redirect(`${taxPath(companyId)}?ok=Period+closed+and+filing+drafts+created`);
}

export async function reopenPeriod(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!companyId || !id) redirect(taxPath(companyId));

  try {
    await db
      .delete(accountingPeriods)
      .where(and(eq(accountingPeriods.id, id), eq(accountingPeriods.companyId, companyId)));
  } catch (err) {
    console.error("[reopenPeriod]", err instanceof Error ? err.message : err);
  }

  revalidatePath(taxPath(companyId));
  redirect(`${taxPath(companyId)}?ok=Period+reopened`);
}
