"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { journalEntries, ledgerEntries } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";
import { ensureChart, syncJournalForEntry } from "@/lib/books/posting";

// Admin console actions. The company id arrives in the form here (unlike the
// self-serve surfaces, which take it from the session) because an admin works
// across tenants by design — requireAdmin() is what gates that.

function reportsPath(companyId: string) {
  return `/admin/${companyId}/reports`;
}

export async function seedChartOfAccounts(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) redirect("/admin");

  await ensureChart(db, companyId);

  revalidatePath(reportsPath(companyId));
  redirect(`${reportsPath(companyId)}?ok=Chart+of+accounts+ready`);
}

/**
 * Post every approved-but-unposted ledger entry as a balanced journal entry.
 *
 * The per-entry write is delegated to syncJournalForEntry, so this shares one
 * transactional, idempotent posting path with the self-serve ledger instead of
 * keeping a second hand-rolled copy that could drift from it.
 */
export async function postApprovedEntries(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  if (!companyId) redirect("/admin");

  const [approved, posted] = await Promise.all([
    db
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.companyId, companyId), eq(ledgerEntries.status, "approved"))),
    db
      .select({ ledgerEntryId: journalEntries.ledgerEntryId })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          isNotNull(journalEntries.ledgerEntryId),
        ),
      ),
  ]);

  const alreadyPosted = new Set(posted.map((p) => p.ledgerEntryId));
  const todo = approved.filter((e) => !alreadyPosted.has(e.id));

  let count = 0;
  let failed = 0;
  for (const e of todo) {
    const res = await syncJournalForEntry(companyId, e.id);
    if (res.ok) count++;
    else failed++;
  }

  revalidatePath(reportsPath(companyId));
  const suffix = failed ? `&warn=${failed}+could+not+be+posted` : "";
  redirect(`${reportsPath(companyId)}?ok=${count}+entries+posted${suffix}`);
}
