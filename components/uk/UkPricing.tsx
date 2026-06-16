import { UK_TIERS, UK_SETUP } from "@/lib/uk-content";

export function UkPricing() {
  return (
    <section id="pricing" className="py-20 lg:py-28">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="eyebrow">
            <span className="h-px w-6 bg-brass-deep" />
            Pricing
          </p>
          <h2 className="mt-5 font-display text-[clamp(1.9rem,1rem+3vw,3rem)] font-semibold leading-tight tracking-[-0.02em]">
            One fixed fee. Everything handled.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            No hourly billing. No surprises. Cancel anytime. Prices in GBP,
            excl. VAT.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {UK_TIERS.map((t) => (
            <article
              key={t.id}
              className={
                t.highlight
                  ? "relative flex flex-col rounded-2xl border p-7 shadow-card border-brass bg-ink text-paper"
                  : "relative flex flex-col rounded-2xl border p-7 shadow-card border-line bg-surface"
              }
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 rounded-full bg-brass px-3 py-1 text-xs font-medium text-ink">
                  Most popular
                </span>
              )}
              <h3
                className={
                  t.highlight
                    ? "font-display text-xl font-medium text-paper"
                    : "font-display text-xl font-medium text-ink"
                }
              >
                {t.name}
              </h3>
              <p
                className={
                  t.highlight ? "mt-1 text-sm text-paper/70" : "mt-1 text-sm text-ink-soft"
                }
              >
                {t.forWho}
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-5xl font-semibold tracking-tight">
                  £{t.price}
                </span>
                <span
                  className={
                    t.highlight ? "text-sm text-paper/70" : "text-sm text-ink-soft"
                  }
                >
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
                        stroke={t.highlight ? "var(--brass)" : "var(--evergreen)"}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className={t.highlight ? "text-paper/90" : "text-ink-soft"}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="#waitlist"
                className={
                  t.highlight
                    ? "mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 bg-brass text-ink hover:bg-[#c79433]"
                    : "mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 bg-ink text-paper hover:bg-[#2c2e35]"
                }
              >
                Get early access
              </a>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-start gap-2 rounded-2xl border border-dashed border-brass/50 bg-brass/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-medium">{UK_SETUP.name}</p>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">{UK_SETUP.note}</p>
          </div>
          <p className="shrink-0 font-display text-2xl font-semibold text-brass-deep">
            £{UK_SETUP.price}
          </p>
        </div>
      </div>
    </section>
  );
}
