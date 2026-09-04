import { AppShell } from "@/components/app/AppShell";
import { requireAdmin } from "@/lib/db/tenant";

// The admin console runs inside the same shell as the customer portal.
//
// It used to have its own PortalShell, whose navigation only existed in a
// desktop sidebar — on a phone the Waitlist and per-client pages were simply
// unreachable, and the nav still pointed at a route set the portal had moved on
// from. Sharing AppShell means one navigation model, the bottom tab bar, and
// safe-area padding everywhere, which also matters for the installed (TWA) app.
//
// Each page still calls requireAdmin() itself. This gate is defence in depth,
// not a replacement: a layout is not a security boundary in the App Router.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdmin();

  return (
    <AppShell isAdmin companyName="Admin console" userEmail={user.email}>
      {children}
    </AppShell>
  );
}
