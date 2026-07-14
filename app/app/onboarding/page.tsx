import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createCompany } from "@/lib/actions";
import { getCompany } from "@/lib/portal";

export const metadata = { title: "Set up your company — Mizan" };

const ZONES = ["IFZA", "DMCC", "Meydan", "SHAMS", "RAKEZ", "DAFZA", "JAFZA", "ADGM", "DIFC", "Mainland", "Other"];

const STEPS = [
  { n: 1, label: "Company details", state: "now" },
  { n: 2, label: "Quick approval", state: "next" },
  { n: 3, label: "Start your books", state: "later" },
];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { company } = await getCompany();
  if (company) redirect("/app");
  const { error } = await searchParams;

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-lg">
        <Link href="/" aria-label="Mizan home">
          <Logo />
        </Link>

        {/* Step indicator */}
        <ol className="mt-8 flex items-center gap-2 text-xs" aria-label="Onboarding steps">
          {STEPS.map((s, i) => (
            <li key={s.n} className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ${
                  s.state === "now"
                    ? "bg-evergreen text-white"
                    : "border border-line text-ink-soft"
                }`}
              >
                <span className="tnum">{s.n}</span> {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="text-ink-soft" aria-hidden>→</span>}
            </li>
          ))}
        </ol>

        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">
          Tell us about your company
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Two minutes. Then we switch your account on — usually the same day — and
          you can start your books.
        </p>

        <form action={createCompany} className="card mt-8 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Company name
            </label>
            <input id="name" name="name" required maxLength={200} placeholder="Acme Trading FZ-LLC" className="field" />
          </div>
          <div>
            <label htmlFor="region" className="mb-1.5 block text-sm font-medium">
              Country / tax regime
            </label>
            <select id="region" name="region" className="field" defaultValue="ae">
              <option value="ae">🇦🇪 UAE — FTA · 5% VAT · 9% corporate tax</option>
              <option value="gb">🇬🇧 UK — HMRC · 20% VAT · MTD</option>
            </select>
            <p className="mt-1.5 text-xs text-ink-soft">
              Sets your currency, VAT rate, chart of accounts and filing deadlines.
            </p>
          </div>
          <div>
            <label htmlFor="free_zone" className="mb-1.5 block text-sm font-medium">
              Free zone / jurisdiction <span className="text-ink-soft">(UAE only)</span>
            </label>
            <select id="free_zone" name="free_zone" className="field" defaultValue="">
              <option value="">Select…</option>
              {ZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" name="vat_registered" defaultChecked className="h-4 w-4 rounded border-line" />
            <span>VAT registered — split VAT out of every transaction</span>
          </label>
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
              Nothing is charged now. You start free while we onboard you, and we
              confirm billing together before anything is due.
            </p>
          </div>

          <label className="flex items-start gap-2.5 border-t border-line pt-4 text-sm">
            <input
              type="checkbox"
              name="agree_terms"
              required
              className="mt-0.5 h-4 w-4 rounded border-line"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-ink">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-ink">
                Privacy Policy
              </Link>
              , and I understand Mizan is bookkeeping software, not a licensed tax
              agent.
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">{error.replace(/\+/g, " ")}</p>
          )}

          <button type="submit" className="btn-primary w-full">
            Create my company
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-soft">
          After this step your account goes for a quick manual approval — we&apos;ll
          switch it on and let you know.
        </p>
      </div>
    </div>
  );
}
