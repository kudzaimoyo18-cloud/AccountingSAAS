"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { requireCompany } from "@/lib/scope";

const CUSTOMERS = "/app/customers";

function readFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim().slice(0, 200),
    email: String(formData.get("email") ?? "").trim().slice(0, 200) || null,
    phone: String(formData.get("phone") ?? "").trim().slice(0, 50) || null,
    trn: String(formData.get("trn") ?? "").trim().slice(0, 50) || null,
    address: String(formData.get("address") ?? "").trim().slice(0, 500) || null,
    notes: String(formData.get("notes") ?? "").trim().slice(0, 1000) || null,
  };
}

export async function createCustomer(formData: FormData) {
  const { userId, company } = await requireCompany();

  const fields = readFields(formData);
  if (!fields.name) redirect(`${CUSTOMERS}?error=Customer+name+is+required`);

  try {
    await db
      .insert(customers)
      .values({ companyId: company.id, createdBy: userId, ...fields });
  } catch (e) {
    console.error("[createCustomer]", (e as Error).message);
    redirect(`${CUSTOMERS}?error=Could+not+save+the+customer`);
  }

  revalidatePath(CUSTOMERS);
  redirect(`${CUSTOMERS}?ok=Customer+added`);
}

export async function updateCustomer(formData: FormData) {
  const { company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${CUSTOMERS}?error=Missing+customer`);

  const fields = readFields(formData);
  if (!fields.name) redirect(`${CUSTOMERS}/${id}?error=Customer+name+is+required`);

  try {
    await db
      .update(customers)
      .set(fields)
      .where(and(eq(customers.id, id), eq(customers.companyId, company.id)));
  } catch (e) {
    console.error("[updateCustomer]", (e as Error).message);
    redirect(`${CUSTOMERS}/${id}?error=Could+not+save+changes`);
  }

  revalidatePath(CUSTOMERS, "layout");
  redirect(`${CUSTOMERS}/${id}?ok=Saved`);
}

export async function setCustomerArchived(formData: FormData) {
  const { company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  if (!id) redirect(`${CUSTOMERS}?error=Missing+customer`);

  try {
    await db
      .update(customers)
      .set({ archived })
      .where(and(eq(customers.id, id), eq(customers.companyId, company.id)));
  } catch (e) {
    console.error("[setCustomerArchived]", (e as Error).message);
    redirect(`${CUSTOMERS}?error=Could+not+update+the+customer`);
  }

  revalidatePath(CUSTOMERS, "layout");
  redirect(
    archived ? `${CUSTOMERS}?ok=Customer+archived` : `${CUSTOMERS}/${id}?ok=Customer+restored`,
  );
}
