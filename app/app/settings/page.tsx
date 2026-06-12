import { redirect } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { getCompany } from "@/lib/portal";
import { TIERS } from "@/lib/content";

export const metadata = { title: "Settings — Mizan" };

export default async function SettingsPage() {
  const { user, profile, company } = await getCompany();
  if (!company) redirect("/app/onboarding");

  const tier = TIERS.find((t) => t.id === company.plan);

  return (
    <PortalShell active="/app/settings" isAdmin={profile?.role === "admin"}>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>

        <div className="card mt-8">
          <h2 className="font-display text-lg font-medium">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Company</dt>
              <dd className="font-medium">{company.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Jurisdiction</dt>
              <dd className="font-medium">{company.free_zone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">License no.</dt>
              <dd className="tnum font-medium">{company.license_no ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="card mt-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Plan</h2>
            <span className="badge bg-brass/10 text-brass-deep">
              {tier?.name ?? company.plan}
            </span>
          </div>
          <p className="tnum mt-3 font-display text-3xl font-semibold">
            AED {tier?.priceAed ?? "—"}
            <span className="ml-1 text-sm font-normal text-ink-soft">/month</span>
          </p>
          <p className="mt-3 text-sm text-ink-soft">
            Billing via Ziina launches soon — your founding-member rate is locked.
            To change plans, message us.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
