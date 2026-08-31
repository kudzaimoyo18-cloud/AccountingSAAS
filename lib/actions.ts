"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { companies, documents } from "@/lib/db/schema";
import { requireProfile, requireWritableTenant } from "@/lib/db/tenant";
import { assertCompanyKey, buildKey, createUploadUrl, statObject } from "@/lib/storage";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

const FREE_ZONES = [
  "IFZA", "DMCC", "Meydan", "SHAMS", "RAKEZ", "DAFZA", "JAFZA", "ADGM", "DIFC", "Mainland", "Other",
] as const;
const PLANS = ["starter", "growth", "pro"] as const;
const REGIONS = ["ae", "gb"] as const;

export async function createCompany(formData: FormData) {
  const { user } = await requireProfile();

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

  try {
    await db.insert(companies).values({
      ownerId: user.id,
      name,
      freeZone: region === "ae" ? freeZone || null : null,
      licenseNo: licenseNo || null,
      plan,
      region,
      vatRegistered,
    });
  } catch (err) {
    console.error("[createCompany]", err instanceof Error ? err.message : err);
    redirect("/app/onboarding?error=Could+not+create+company");
  }

  revalidatePath("/app");
  redirect("/app");
}

/**
 * Mint a presigned upload URL for the browser.
 *
 * The file goes straight from the browser to R2, so the request body stays tiny
 * and Vercel's ~4.5MB function cap can never 413 a large upload. The company
 * prefix on the key comes from the session, never from the client, and
 * createUploadUrl re-checks it — a client that rewrites the key gets a signature
 * for its own folder or nothing at all.
 */
export async function createDocumentUploadUrl(
  filename: string,
  contentType: string,
  folder: "documents" | "captures" | "statements" = "documents",
): Promise<{ url: string; key: string } | { error: string }> {
  const { company } = await requireWritableTenant();

  const safeType = (contentType || "application/octet-stream").slice(0, 128);
  const key = buildKey(company.id, folder, filename || "upload");

  try {
    const url = await createUploadUrl(key, company.id, safeType);
    return { url, key };
  } catch (err) {
    console.error("[createDocumentUploadUrl]", err instanceof Error ? err.message : err);
    return { error: "Could not start the upload. Please try again." };
  }
}

/**
 * Record a document the browser has already uploaded to R2. The action receives
 * only the object key; the company comes from the session, never a form field.
 */
export async function recordDocument(formData: FormData) {
  const { company, user } = await requireWritableTenant();

  const key = String(formData.get("path") ?? "");
  const kind = String(formData.get("kind") ?? "other");
  const originalName = String(formData.get("original_name") ?? "").slice(0, 200);

  try {
    assertCompanyKey(key, company.id);
  } catch {
    redirect("/app/documents?error=Choose+a+file");
  }

  // Confirm the object actually exists before recording a row that points at
  // nothing — a failed browser upload would otherwise leave a broken document.
  const meta = await statObject(key, company.id);
  if (!meta) {
    redirect("/app/documents?error=Upload+did+not+complete+—+please+try+again");
  }

  try {
    await db.insert(documents).values({
      companyId: company.id,
      uploadedBy: user.id,
      storagePath: key,
      originalName: originalName || key.split("/").pop() || "document",
      kind: ["invoice", "receipt", "bank_statement", "other"].includes(kind) ? kind : "other",
    });
  } catch (err) {
    console.error("[recordDocument] db:", err instanceof Error ? err.message : err);
    redirect("/app/documents?error=Could+not+record+document");
  }

  revalidatePath("/app/documents");
  redirect("/app/documents?ok=1");
}

export async function signOut() {
  // nextCookies() in the Better Auth config is what lets this clear the session
  // cookie from a server action.
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
