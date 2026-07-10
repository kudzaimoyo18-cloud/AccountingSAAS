import { BRAND } from "@/lib/content";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-line bg-surface">
      <div className="shell grid items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <p className="eyebrow rise rise-1">
            <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
            For UAE free-zone companies
          </p>

          <h1 className="rise rise-2 mt-5 text-[clamp(2.4rem,1.2rem+4vw,4rem)] font-semibold leading-[1.05] tracking-tight text-ink">
            Books balanced.
            <br />
            Taxes ready.{" "}
            <span className="text-evergreen">Done.</span>
          </h1>

          <p className="rise rise-3 mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            {BRAND.promise} Nothing posts without your approval — and it&apos;s a
            fixed monthly fee, not hourly bills.
          </p>

          <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-3">
            <a href="#waitlist" className="btn-primary">
              Get early access
            </a>
            <a href="#pricing" className="btn-ghost">
              See pricing
            </a>
          </div>

          <p className="rise rise-4 mt-6 flex items-center gap-2 text-sm text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" />
            Now onboarding founding members — first 50 companies get setup free.
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  const rows = [
    { label: "DEWA invoice — utilities", value: "AED 1,240", meta: "approved", done: true },
    { label: "Client invoice — sales", value: "AED 12,600", meta: "approved", done: true },
    { label: "VAT position (5%)", value: "AED 568", meta: "due", done: false },
    { label: "Net profit, this period", value: "AED 84,300", meta: "", done: false },
  ];
  return (
    <div className="rise rise-3 panel overflow-hidden">
      <div className="panel-header">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-ink-soft">
            Your books — live
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink">Meridian Trading FZ-LLC</p>
        </div>
        <span className="badge badge-positive">
          <span className="h-1.5 w-1.5 rounded-full bg-positive" />
          Balanced
        </span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between px-5 py-3.5">
            <span className="flex items-center gap-2.5 text-sm text-ink-soft">
              {r.done && (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden className="shrink-0">
                  <path
                    d="M3 8l3 3 6-7"
                    stroke="rgb(var(--positive-rgb))"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {r.label}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="tnum text-sm font-semibold text-ink">{r.value}</span>
              {r.meta && (
                <span className={`text-xs ${r.meta === "due" ? "text-warning" : "text-ink-soft"}`}>
                  {r.meta}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
