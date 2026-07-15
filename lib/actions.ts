"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany } from "@/lib/books/repo";

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
  if (formData.get("agree_terms") !== "on")
    redirect("/app/onboarding?error=Please+accept+the+Terms+and+Privacy+Policy");
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

// The browser uploads the file straight to Supabase Storage (storage RLS
// scopes writes to the caller's company folder) and this action only records
// the path — the request body stays tiny, so Vercel's ~4.5MB function cap
// can't 413 a large file. Company comes from the session, never a form field.
export async function recordDocument(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const path = String(formData.get("path") ?? "");
  const kind = String(formData.get("kind") ?? "other");
  const originalName = String(formData.get("original_name") ?? "").slice(0, 200);

  if (!path || !path.startsWith(`${company.id}/`) || path.includes("..")) {
    redirect("/app/documents?error=Choose+a+file");
  }

  const { error: dbErr } = await supabase.from("documents").insert({
    company_id: company.id,
    uploaded_by: user.id,
    storage_path: path,
    original_name: originalName || path.split("/").pop() || "document",
    kind: ["invoice", "receipt", "bank_statement", "other"].includes(kind)
      ? kind
      : "other",
  });

  if (dbErr) {
    console.error("[recordDocument] db:", dbErr.message);
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
