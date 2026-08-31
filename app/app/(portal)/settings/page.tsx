import { redirect } from "next/navigation";
import { getCompany } from "@/lib/portal";
import { TIERS } from "@/lib/content";

export const metadata = { title: "Settings — Mizan" };

export default async function SettingsPage() {
  const { user, company } = await getCompany();
  if (!company) redirect("/app/onboarding");

  const tier = TIERS.find((t) => t.id === company.plan);

  return (
    <div className="mx-auto max-w-2xl">
        <div className="card">
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
              <dd className="font-medium">{company.freeZone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">License no.</dt>
              <dd className="tnum font-medium">{company.licenseNo ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="card mt-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Plan</h2>
            <span className="badge bg-evergreen/10 text-evergreen-deep">
              {tier?.name ?? company.plan}
            </span>
          </div>
          <p className="tnum mt-3 font-display text-3xl font-semibold">
            AED {tier?.priceAed ?? "—"}
            <span className="ml-1 text-sm font-normal text-ink-soft">/month</span>
          </p>
          <p className="mt-3 text-sm text-ink-soft">
            Pay securely via Ziina on the{" "}
            <a href="/app/billing" className="text-evergreen-deep underline underline-offset-4">
              billing page
            </a>
            . Your founding-member rate is locked.
          </p>
        </div>
      </div>
  );
}
