import { UK_PROBLEMS } from "@/lib/uk-content";

export function UkProblem() {
  return (
    <section className="py-20 lg:py-28">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="eyebrow">
            <span className="h-px w-6 bg-brass-deep" />
            Why now
          </p>
          <h2 className="mt-5 font-display text-[clamp(1.9rem,1rem+3vw,3rem)] font-semibold leading-tight tracking-[-0.02em]">
            Making Tax Digital changes everything.
            <br />
            Most freelancers aren&apos;t ready.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            One annual return becomes four. Spreadsheets won&apos;t cut it. From
            April 2026 the rules arrive — and the penalties are real.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {UK_PROBLEMS.map((p) => (
            <article key={p.label} className="card">
              <p className="font-display text-4xl font-semibold text-brass-deep">
                {p.stat}
              </p>
              <p className="mt-3 text-sm font-medium text-ink">{p.label}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {p.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
