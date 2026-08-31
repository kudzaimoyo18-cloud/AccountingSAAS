"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { onlyThisCompany, requireWritableTenant } from "@/lib/db/tenant";

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
  // The company always comes from the session — never from a form field.
  const { company, user } = await requireWritableTenant();

  const fields = readFields(formData);
  if (!fields.name) redirect(`${CUSTOMERS}?error=Customer+name+is+required`);

  try {
    await db.insert(customers).values({
      companyId: company.id,
      createdBy: user.id,
      ...fields,
    });
  } catch (err) {
    console.error("[createCustomer]", err instanceof Error ? err.message : err);
    redirect(`${CUSTOMERS}?error=Could+not+save+the+customer`);
  }

  revalidatePath(CUSTOMERS);
  redirect(`${CUSTOMERS}?ok=Customer+added`);
}

export async function updateCustomer(formData: FormData) {
  const { company } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${CUSTOMERS}?error=Missing+customer`);

  const fields = readFields(formData);
  if (!fields.name) redirect(`${CUSTOMERS}/${id}?error=Customer+name+is+required`);

  const updated = await db
    .update(customers)
    .set(fields)
    .where(onlyThisCompany(customers, company.id, eq(customers.id, id)))
    .returning({ id: customers.id });

  if (updated.length === 0) {
    console.error("[updateCustomer] no row updated", id);
    redirect(`${CUSTOMERS}/${id}?error=Could+not+save+changes`);
  }

  revalidatePath(CUSTOMERS, "layout");
  redirect(`${CUSTOMERS}/${id}?ok=Saved`);
}

export async function setCustomerArchived(formData: FormData) {
  const { company } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  if (!id) redirect(`${CUSTOMERS}?error=Missing+customer`);

  const updated = await db
    .update(customers)
    .set({ archived })
    .where(onlyThisCompany(customers, company.id, eq(customers.id, id)))
    .returning({ id: customers.id });

  if (updated.length === 0) {
    console.error("[setCustomerArchived] no row updated", id);
    redirect(`${CUSTOMERS}?error=Could+not+update+the+customer`);
  }

  revalidatePath(CUSTOMERS, "layout");
  redirect(
    archived ? `${CUSTOMERS}?ok=Customer+archived` : `${CUSTOMERS}/${id}?ok=Customer+restored`,
  );
}
