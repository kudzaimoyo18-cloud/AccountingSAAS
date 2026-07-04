import { BRAND } from "@/lib/content";

export function Hero() {
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
            For UAE free-zone companies
          </p>

          <h1 className="rise rise-2 mt-6 font-display text-[clamp(2.6rem,1.2rem+5vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
            Books balanced.
            <br />
            Taxes ready.{" "}
            <span className="italic text-brass-deep">Done.</span>
          </h1>

          <p className="rise rise-3 mt-7 max-w-xl text-lg leading-relaxed text-ink-soft">
            {BRAND.promise} Nothing posts without your approval — and it&apos;s a
            fixed monthly fee, not hourly bills.
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
            founding members — first 50 companies get setup free.
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  const rows = [
    { label: "DEWA invoice — utilities", value: "AED 1,240 · approved", done: true },
    { label: "Client invoice — sales", value: "AED 12,600 · approved", done: true },
    { label: "VAT position (5%)", value: "AED 568 due", done: false },
    { label: "Net profit, this period", value: "AED 84,300", done: false },
  ];
  return (
    <div className="rise rise-3 relative">
      <div className="card relative z-10">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">
              Your books — live
            </p>
            <p className="font-display text-lg font-medium">Meridian Trading FZ-LLC</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-evergreen/10 px-3 py-1 text-xs font-medium text-evergreen">
            <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
            Balanced
          </span>
        </div>
        <ul className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between py-3.5">
              <span className="text-sm text-ink-soft">{r.label}</span>
              <span
                className={`inline-flex items-center gap-2 text-sm font-medium ${
                  r.done ? "text-ink" : "text-brass-deep"
                }`}
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
        className="absolute -bottom-5 -right-4 left-8 top-10 -z-0 rounded-3xl border border-line bg-paper-dim"
      />
    </div>
  );
}
