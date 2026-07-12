"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany } from "@/lib/books/repo";

const CUSTOMERS = "/app/customers";

/** Session-scoped company — never trust a form-supplied company_id. */
async function requireCompany() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");
  return { supabase, user, company };
}

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
  const { supabase, user, company } = await requireCompany();

  const fields = readFields(formData);
  if (!fields.name) redirect(`${CUSTOMERS}?error=Customer+name+is+required`);

  const { error } = await supabase.from("customers").insert({
    company_id: company.id,
    created_by: user.id,
    ...fields,
  });

  if (error) {
    console.error("[createCustomer]", error.message);
    redirect(`${CUSTOMERS}?error=Could+not+save+the+customer`);
  }

  revalidatePath(CUSTOMERS);
  redirect(`${CUSTOMERS}?ok=Customer+added`);
}

export async function updateCustomer(formData: FormData) {
  const { supabase, company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${CUSTOMERS}?error=Missing+customer`);

  const fields = readFields(formData);
  if (!fields.name) redirect(`${CUSTOMERS}/${id}?error=Customer+name+is+required`);

  const { error } = await supabase
    .from("customers")
    .update(fields)
    .eq("id", id)
    .eq("company_id", company.id);

  if (error) {
    console.error("[updateCustomer]", error.message);
    redirect(`${CUSTOMERS}/${id}?error=Could+not+save+changes`);
  }

  revalidatePath(CUSTOMERS, "layout");
  redirect(`${CUSTOMERS}/${id}?ok=Saved`);
}

export async function setCustomerArchived(formData: FormData) {
  const { supabase, company } = await requireCompany();

  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  if (!id) redirect(`${CUSTOMERS}?error=Missing+customer`);

  const { error } = await supabase
    .from("customers")
    .update({ archived })
    .eq("id", id)
    .eq("company_id", company.id);

  if (error) {
    console.error("[setCustomerArchived]", error.message);
    redirect(`${CUSTOMERS}?error=Could+not+update+the+customer`);
  }

  revalidatePath(CUSTOMERS, "layout");
  redirect(
    archived ? `${CUSTOMERS}?ok=Customer+archived` : `${CUSTOMERS}/${id}?ok=Customer+restored`,
  );
}
