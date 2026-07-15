import { TIERS, SETUP } from "@/lib/content";

export function Pricing() {
  return (
    <section id="pricing" className="py-20 lg:py-28">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
            Pricing
          </p>
          <h2 className="mt-4 text-[clamp(1.8rem,1rem+2.6vw,2.6rem)] font-semibold leading-tight tracking-tight text-ink">
            One fixed fee. Everything handled.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            No hourly billing. No surprises. Cancel anytime. Prices in AED,
            excl. VAT.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TIERS.map((t) => (
            <article
              key={t.id}
              className={`relative flex flex-col rounded-xl border bg-surface p-7 shadow-card ${
                t.highlight ? "border-evergreen ring-1 ring-evergreen" : "border-line"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 rounded-md bg-evergreen px-2.5 py-1 text-xs font-semibold text-sidebar">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-ink">{t.name}</h3>
              <p className="mt-1 text-sm text-ink-soft">{t.forWho}</p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-ink-soft">AED</span>
                <span className="tnum text-4xl font-semibold tracking-tight text-ink">
                  {t.priceAed}
                </span>
                <span className="text-sm text-ink-soft">
                  /{t.cadence.replace("per ", "")}
                </span>
              </div>

              <ul className="mt-7 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 15 15"
                      fill="none"
                      className="mt-0.5 shrink-0"
                      aria-hidden
                    >
                      <path
                        d="M3 8l3 3 6-7"
                        stroke="rgb(var(--evergreen-rgb))"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-ink-soft">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#waitlist"
                className={`mt-8 ${t.highlight ? "btn-primary" : "btn-ghost"}`}
              >
                Get early access
              </a>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-start gap-2 rounded-xl border border-line bg-paper-dim p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-ink">{SETUP.name}</p>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">{SETUP.note}</p>
          </div>
          <p className="tnum shrink-0 text-2xl font-semibold text-ink">
            AED {SETUP.priceAed}
          </p>
        </div>
      </div>
    </section>
  );
}
