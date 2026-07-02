import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { getCompany } from "@/lib/portal";
import { TIERS } from "@/lib/content";
import { PAYMENT_LINKS } from "@/lib/billing";

export const metadata = { title: "Billing — Mizan" };

export default async function BillingPage() {
  const { company } = await getCompany();
  if (!company) redirect("/app/onboarding");

  return (
    <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Billing</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Monthly retainer, paid securely via Ziina. Founding-member pricing — locked for life.
            </p>
          </div>
          <StatusBadge status={company.status} />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {TIERS.map((t) => {
            const link = PAYMENT_LINKS[t.id];
            const isCurrent = company.plan === t.id;
            return (
              <article
                key={t.id}
                className={`flex flex-col rounded-2xl border p-6 shadow-card ${
                  isCurrent ? "border-brass bg-surface" : "border-line bg-surface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-medium">{t.name}</h2>
                  {isCurrent && (
                    <span className="badge bg-brass/10 text-brass-deep">Your plan</span>
                  )}
                </div>
                <p className="tnum mt-4 font-display text-4xl font-semibold">
                  AED {t.priceAed}
                  <span className="ml-1 text-sm font-normal text-ink-soft">/mo</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {t.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm text-ink-soft">
                      <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="mt-0.5 shrink-0" aria-hidden>
                        <path d="M3 8l3 3 6-7" stroke="rgb(var(--evergreen-rgb))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 ${
                    isCurrent
                      ? "bg-ink text-paper"
                      : "border border-line text-ink hover:border-ink"
                  }`}
                >
                  Pay AED {link.amountAed} via Ziina
                </a>
              </article>
            );
          })}
        </div>

        <div className="card mt-8">
          <h2 className="font-display text-lg font-medium">How payment works</h2>
          <ol className="mt-4 space-y-3 text-sm text-ink-soft">
            <li className="flex gap-3">
              <span className="tnum font-display font-semibold text-brass-deep">1.</span>
              Tap the Ziina button for your plan — pay by card or Ziina app. Use your company
              name in the payment note.
            </li>
            <li className="flex gap-3">
              <span className="tnum font-display font-semibold text-brass-deep">2.</span>
              We confirm your payment and activate your compliance file — same business day.
            </li>
            <li className="flex gap-3">
              <span className="tnum font-display font-semibold text-brass-deep">3.</span>
              Each month you get a fresh payment link before renewal. No auto-charges, no surprises.
            </li>
          </ol>
          <p className="mt-5 border-t border-line pt-4 text-xs text-ink-soft">
            Founding members: setup fee (AED 1,500) waived. Your monthly rate never increases
            while your subscription stays active.
          </p>
        </div>
      </div>
  );
}
