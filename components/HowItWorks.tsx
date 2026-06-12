import { STEPS } from "@/lib/content";

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-line bg-paper-dim/50 py-20 lg:py-28">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="eyebrow">
            <span className="h-px w-6 bg-brass-deep" />
            How it works
          </p>
          <h2 className="mt-5 font-display text-[clamp(1.9rem,1rem+3vw,3rem)] font-semibold leading-tight tracking-[-0.02em]">
            You forward. We handle the rest.
          </h2>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-surface p-8">
              <span className="font-display text-sm font-semibold text-brass-deep">
                {s.n}
              </span>
              <h3 className="mt-4 font-display text-xl font-medium">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
