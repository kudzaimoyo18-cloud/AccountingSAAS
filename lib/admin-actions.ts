"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, complianceItems, documents } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";

const ITEM_KINDS = ["vat_return", "corporate_tax", "bookkeeping", "registration", "other"];
const ITEM_STATUSES = ["upcoming", "in_progress", "filed", "overdue"];

export async function addComplianceItem(formData: FormData) {
  await requireAdmin();

  const companyId = String(formData.get("company_id") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const kind = String(formData.get("kind") ?? "other");
  const dueDate = String(formData.get("due_date") ?? "");

  if (!companyId || !title) redirect(`/admin/${companyId}?error=Title+required`);

  try {
    await db.insert(complianceItems).values({
      companyId,
      title,
      kind: ITEM_KINDS.includes(kind) ? kind : "other",
      dueDate: dueDate || null,
    });
  } catch (err) {
    console.error("[addComplianceItem]", err instanceof Error ? err.message : err);
    redirect(`/admin/${companyId}?error=Could+not+add+item`);
  }

  revalidatePath(`/admin/${companyId}`);
  redirect(`/admin/${companyId}`);
}

export async function setComplianceStatus(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !ITEM_STATUSES.includes(status)) redirect(`/admin/${companyId}`);

  try {
    await db
      .update(complianceItems)
      .set({ status, filedAt: status === "filed" ? new Date() : null })
      .where(and(eq(complianceItems.id, id), eq(complianceItems.companyId, companyId)));
  } catch (err) {
    console.error("[setComplianceStatus]", err instanceof Error ? err.message : err);
  }

  revalidatePath(`/admin/${companyId}`);
  redirect(`/admin/${companyId}`);
}

export async function markDocProcessed(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");

  try {
    await db
      .update(documents)
      .set({ status: "processed" })
      .where(and(eq(documents.id, id), eq(documents.companyId, companyId)));
  } catch (err) {
    console.error("[markDocProcessed]", err instanceof Error ? err.message : err);
  }

  revalidatePath(`/admin/${companyId}`);
  redirect(`/admin/${companyId}`);
}

const COMPANY_STATUSES = ["onboarding", "active", "paused"];

export async function setCompanyStatus(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("company_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !COMPANY_STATUSES.includes(status)) redirect(`/admin/${id}`);

  try {
    await db.update(companies).set({ status }).where(eq(companies.id, id));
  } catch (err) {
    console.error("[setCompanyStatus]", err instanceof Error ? err.message : err);
  }

  revalidatePath(`/admin/${id}`);
  revalidatePath("/admin");
  redirect(`/admin/${id}`);
}
