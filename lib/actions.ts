"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const FREE_ZONES = [
  "IFZA", "DMCC", "Meydan", "SHAMS", "RAKEZ", "DAFZA", "JAFZA", "ADGM", "DIFC", "Mainland", "Other",
] as const;
const PLANS = ["starter", "growth", "pro"] as const;
const REGIONS = ["ae", "gb"] as const;

export async function createCompany(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  const freeZone = String(formData.get("free_zone") ?? "").trim();
  const licenseNo = String(formData.get("license_no") ?? "").trim().slice(0, 100);
  const plan = String(formData.get("plan") ?? "starter");
  const region = String(formData.get("region") ?? "ae");
  const vatRegistered = formData.get("vat_registered") === "on";

  if (!name) redirect("/app/onboarding?error=Company+name+is+required");
  if (!REGIONS.includes(region as (typeof REGIONS)[number]))
    redirect("/app/onboarding?error=Invalid+region");
  if (!PLANS.includes(plan as (typeof PLANS)[number]))
    redirect("/app/onboarding?error=Invalid+plan");
  if (freeZone && !FREE_ZONES.includes(freeZone as (typeof FREE_ZONES)[number]))
    redirect("/app/onboarding?error=Invalid+free+zone");

  const { error } = await supabase.from("companies").insert({
    owner_id: user.id,
    name,
    free_zone: region === "ae" ? freeZone || null : null,
    license_no: licenseNo || null,
    plan,
    region,
    vat_registered: vatRegistered,
  });

  if (error) {
    console.error("[createCompany]", error.message);
    redirect("/app/onboarding?error=Could+not+create+company");
  }

  revalidatePath("/app");
  redirect("/app");
}

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("file") as File | null;
  const kind = String(formData.get("kind") ?? "other");
  const companyId = String(formData.get("company_id") ?? "");

  if (!file || file.size === 0) redirect("/app/documents?error=Choose+a+file");
  if (file.size > 15 * 1024 * 1024)
    redirect("/app/documents?error=File+too+large+(max+15MB)");
  if (!companyId) redirect("/app/documents?error=Missing+company");

  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 140);
  const path = `${companyId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });

  if (upErr) {
    console.error("[uploadDocument] storage:", upErr.message);
    redirect("/app/documents?error=Upload+failed");
  }

  const { error: dbErr } = await supabase.from("documents").insert({
    company_id: companyId,
    uploaded_by: user.id,
    storage_path: path,
    original_name: file.name.slice(0, 200),
    kind: ["invoice", "receipt", "bank_statement", "other"].includes(kind)
      ? kind
      : "other",
  });

  if (dbErr) {
    console.error("[uploadDocument] db:", dbErr.message);
    redirect("/app/documents?error=Could+not+record+document");
  }

  revalidatePath("/app/documents");
  redirect("/app/documents?ok=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
