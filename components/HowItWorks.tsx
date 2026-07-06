import { STEPS } from "@/lib/content";

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-line bg-paper py-20 lg:py-24">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
            How it works
          </p>
          <h2 className="mt-4 text-[clamp(1.8rem,1rem+2.6vw,2.6rem)] font-semibold leading-tight tracking-tight text-ink">
            You upload. You approve. That&apos;s the job.
          </h2>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-surface p-7">
              <span className="tnum grid h-8 w-8 place-items-center rounded-lg bg-evergreen-soft text-sm font-semibold text-evergreen">
                {s.n}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
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
