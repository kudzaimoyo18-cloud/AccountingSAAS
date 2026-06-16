import { UK_BRAND } from "@/lib/uk-content";

export function UkHero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* soft brass glow, not a generic gradient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-32 h-[34rem] w-[34rem] rounded-full opacity-[0.16]"
        style={{
          background:
            "radial-gradient(circle, var(--brass) 0%, transparent 62%)",
        }}
      />
      <div className="shell grid items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div>
          <p className="eyebrow rise rise-1">
            <span className="h-px w-6 bg-brass-deep" />
            For UK freelancers &amp; sole traders
          </p>

          <h1 className="rise rise-2 mt-6 font-display text-[clamp(2.6rem,1.2rem+5vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
            Books balanced.
            <br />
            Tax filed. <span className="italic text-brass-deep">Done.</span>
          </h1>

          <p className="rise rise-3 mt-7 max-w-xl text-lg leading-relaxed text-ink-soft">
            Making Tax Digital is here. {UK_BRAND.promise} A fixed monthly fee —
            reviewed and filed by an HMRC-registered agent. No spreadsheets, no
            surprise bills.
          </p>

          <div className="rise rise-4 mt-9 flex flex-wrap items-center gap-3">
            <a href="#waitlist" className="btn-primary">
              Get early access
            </a>
            <a href="#pricing" className="btn-ghost">
              See pricing
            </a>
          </div>

          <p className="rise rise-4 mt-6 text-sm text-ink-soft">
            <span className="font-medium text-evergreen">●</span> Now onboarding
            founding members — first 50 get switch &amp; setup free.
          </p>
        </div>

        <UkHeroVisual />
      </div>
    </section>
  );
}

function UkHeroVisual() {
  const rows = [
    { label: "Bookkeeping", value: "Up to date", done: true },
    { label: "MTD update — Q1", value: "Filed", done: true },
    { label: "VAT return", value: "Filed", done: true },
    { label: "Next deadline", value: "5 Aug", done: false },
  ];
  return (
    <div className="rise rise-3 relative">
      <div className="card relative z-10">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">
              HMRC status
            </p>
            <p className="font-display text-lg font-medium">J. Carter — Sole trader</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-evergreen/10 px-3 py-1 text-xs font-medium text-evergreen">
            <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
            Up to date
          </span>
        </div>
        <ul className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between py-3.5">
              <span className="text-sm text-ink-soft">{r.label}</span>
              <span
                className={
                  r.done
                    ? "inline-flex items-center gap-2 text-sm font-medium text-ink"
                    : "inline-flex items-center gap-2 text-sm font-medium text-brass-deep"
                }
              >
                {r.done && (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                    <path
                      d="M3 8l3 3 6-7"
                      stroke="var(--evergreen)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {r.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {/* layered card behind for depth */}
      <div
        aria-hidden
        className="absolute -bottom-5 -right-4 left-8 top-10 -z-0 rounded-2xl border border-line bg-paper-dim"
      />
    </div>
  );
}
