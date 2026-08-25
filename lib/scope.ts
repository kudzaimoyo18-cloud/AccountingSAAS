import "server-only";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getActiveCompany, type BooksCompany } from "@/lib/books/repo";

// The company-scope guard used by every server action. Identity comes from
// Clerk; getActiveCompany resolves only a company the caller owns or is an
// active member of. Callers still filter every query by company.id — with RLS
// gone, that explicit scoping IS the tenant isolation.
export async function requireCompany(): Promise<{
  userId: string;
  company: BooksCompany;
}> {
  const userId = await requireUserId();
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");
  return { userId, company };
}
