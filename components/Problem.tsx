import { PROBLEMS } from "@/lib/content";

export function Problem() {
  return (
    <section className="py-20 lg:py-28">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
            Why now
          </p>
          <h2 className="mt-4 text-[clamp(1.8rem,1rem+2.6vw,2.6rem)] font-semibold leading-tight tracking-tight text-ink">
            The UAE stopped being tax-free.
            <br />
            Most companies aren&apos;t ready.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            VAT in 2018. Corporate tax in 2023. The rules arrived fast — and the
            penalties are real. Compliance is no longer optional.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <article key={p.label} className="card">
              <p className="tnum text-3xl font-semibold tracking-tight text-evergreen">
                {p.stat}
              </p>
              <p className="mt-3 text-sm font-semibold text-ink">{p.label}</p>
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
