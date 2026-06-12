"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

const ITEM_KINDS = ["vat_return", "corporate_tax", "bookkeeping", "registration", "other"];
const ITEM_STATUSES = ["upcoming", "in_progress", "filed", "overdue"];

export async function addComplianceItem(formData: FormData) {
  const { supabase } = await requireAdmin();

  const companyId = String(formData.get("company_id") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const kind = String(formData.get("kind") ?? "other");
  const dueDate = String(formData.get("due_date") ?? "");

  if (!companyId || !title) redirect(`/admin/${companyId}?error=Title+required`);

  const { error } = await supabase.from("compliance_items").insert({
    company_id: companyId,
    title,
    kind: ITEM_KINDS.includes(kind) ? kind : "other",
    due_date: dueDate || null,
  });

  if (error) {
    console.error("[addComplianceItem]", error.message);
    redirect(`/admin/${companyId}?error=Could+not+add+item`);
  }

  revalidatePath(`/admin/${companyId}`);
  redirect(`/admin/${companyId}`);
}

export async function setComplianceStatus(formData: FormData) {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !ITEM_STATUSES.includes(status)) redirect(`/admin/${companyId}`);

  const { error } = await supabase
    .from("compliance_items")
    .update({
      status,
      filed_at: status === "filed" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) console.error("[setComplianceStatus]", error.message);

  revalidatePath(`/admin/${companyId}`);
  redirect(`/admin/${companyId}`);
}

export async function markDocProcessed(formData: FormData) {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("company_id") ?? "");

  const { error } = await supabase
    .from("documents")
    .update({ status: "processed" })
    .eq("id", id);

  if (error) console.error("[markDocProcessed]", error.message);

  revalidatePath(`/admin/${companyId}`);
  redirect(`/admin/${companyId}`);
}
