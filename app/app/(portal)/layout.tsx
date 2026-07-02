import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { getCompany } from "@/lib/portal";
import { linkMemberships } from "@/lib/books/repo";

// Shared shell for the whole authenticated portal. This runs once when entering
// the portal and stays mounted across tab switches — navigating between Books,
// Reviews, Reports, etc. only re-renders the page content, not the sidebar or
// the auth/company lookups. That's what removes the tab-to-tab lag.
//
// Onboarding lives OUTSIDE this route group (app/app/onboarding), so a brand-new
// user without a company is redirected there without hitting a layout loop.
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Link any pending tax-agent invites for this user, once per portal entry.
  await linkMemberships();

  const { profile, company } = await getCompany();
  if (!company) redirect("/app/onboarding");

  return <AppShell isAdmin={profile?.role === "admin"}>{children}</AppShell>;
}
