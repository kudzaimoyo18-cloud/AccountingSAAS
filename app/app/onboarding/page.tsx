import { redirect } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { createCompany } from "@/lib/actions";
import { getCompany } from "@/lib/portal";

export const metadata = { title: "Set up your company — Mizan" };

const ZONES = ["IFZA", "DMCC", "Meydan", "SHAMS", "RAKEZ", "DAFZA", "JAFZA", "ADGM", "DIFC", "Mainland", "Other"];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile, company } = await getCompany();
  if (company) redirect("/app");
  const { error } = await searchParams;

  return (
    <PortalShell active="/app" isAdmin={profile?.role === "admin"}>
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Tell us about your company
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Two minutes. This sets up your compliance file.
        </p>

        <form action={createCompany} className="card mt-8 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Company name
            </label>
            <input id="name" name="name" required maxLength={200} placeholder="Acme Trading FZ-LLC" className="field" />
          </div>
          <div>
            <label htmlFor="free_zone" className="mb-1.5 block text-sm font-medium">
              Free zone / jurisdiction
            </label>
            <select id="free_zone" name="free_zone" className="field" defaultValue="">
              <option value="" disabled>Select…</option>
              {ZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="license_no" className="mb-1.5 block text-sm font-medium">
              Trade license number <span className="text-ink-soft">(optional)</span>
            </label>
            <input id="license_no" name="license_no" maxLength={100} className="field" />
          </div>
          <div>
            <label htmlFor="plan" className="mb-1.5 block text-sm font-medium">
              Plan
            </label>
            <select id="plan" name="plan" className="field" defaultValue="growth">
              <option value="starter">Starter — AED 349/mo</option>
              <option value="growth">Growth — AED 999/mo</option>
              <option value="pro">Pro — AED 2,900/mo</option>
            </select>
            <p className="mt-1.5 text-xs text-ink-soft">
              Nothing is charged yet — we confirm your plan together during onboarding.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full">
            Create my compliance file
          </button>
        </form>
      </div>
    </PortalShell>
  );
}
