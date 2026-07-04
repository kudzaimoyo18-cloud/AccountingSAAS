import { WaitlistForm } from "./WaitlistForm";

export function CtaSection() {
  return (
    <section id="waitlist" className="py-20 lg:py-28">
      <div className="shell">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-ink px-6 py-14 text-paper sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-25"
            style={{
              background: "radial-gradient(circle, var(--brass) 0%, transparent 60%)",
            }}
          />
          <div className="relative mx-auto grid max-w-4xl items-center gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="eyebrow text-brass">
                <span className="h-px w-6 bg-brass" />
                Founding members
              </p>
              <h2 className="mt-5 font-display text-[clamp(1.9rem,1rem+3vw,2.9rem)] font-semibold leading-tight tracking-[-0.02em] text-paper">
                Stop worrying about the FTA.
              </h2>
              <p className="mt-4 text-paper/70">
                Mizan is invite-only while we onboard founding members. Join the
                waitlist — the first 50 companies get setup free and founding
                pricing locked for life.
              </p>
            </div>
            <div className="rounded-3xl bg-paper p-6 text-ink shadow-card">
              <WaitlistForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
