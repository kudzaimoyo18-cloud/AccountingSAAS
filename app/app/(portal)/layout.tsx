import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { getCompany } from "@/lib/portal";
import { PendingApproval } from "@/components/app/PendingApproval";

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

  const { user, profile, company } = await getCompany();
  if (!company) redirect("/app/onboarding");

  const isAdmin = profile?.role === "admin";
  // Manual-approval gate: a new company is 'onboarding' until an admin activates
  // it from /admin. Admins bypass the gate so they can do the approving.
  if (!isAdmin && company.status !== "active") {
    return <PendingApproval companyName={company.name} email={user.email} />;
  }

  return (
    <AppShell isAdmin={isAdmin} companyName={company.name} userEmail={user.email}>
      {children}
    </AppShell>
  );
}
