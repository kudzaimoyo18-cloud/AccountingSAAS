import { PROBLEMS } from "@/lib/content";

export function Problem() {
  return (
    <section className="py-20 lg:py-28">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="eyebrow">
            <span className="h-px w-6 bg-brass-deep" />
            Why now
          </p>
          <h2 className="mt-5 font-display text-[clamp(1.9rem,1rem+3vw,3rem)] font-semibold leading-tight tracking-[-0.02em]">
            The UAE stopped being tax-free.
            <br />
            Most companies aren&apos;t ready.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            VAT in 2018. Corporate tax in 2023. The rules arrived fast — and the
            penalties are real. Compliance is no longer optional.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PROBLEMS.map((p) => (
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
