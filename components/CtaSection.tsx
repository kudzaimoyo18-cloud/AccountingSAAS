import { WaitlistForm } from "./WaitlistForm";

export function CtaSection() {
  return (
    <section id="waitlist" className="py-20 lg:py-28">
      <div className="shell">
        <div className="relative overflow-hidden rounded-2xl bg-sidebar px-6 py-14 sm:px-12">
          <div className="relative mx-auto grid max-w-4xl items-center gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="eyebrow !text-evergreen">
                <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
                Founding members
              </p>
              <h2 className="mt-4 text-[clamp(1.8rem,1rem+2.6vw,2.6rem)] font-semibold leading-tight tracking-tight text-sidebar-fg">
                Stop worrying about the FTA.
              </h2>
              <p className="mt-4 text-sidebar-fg/70">
                Mizan is invite-only while we onboard founding members. Join the
                waitlist — the first 50 companies get setup free and founding
                pricing locked for life.
              </p>
            </div>
            <div className="rounded-xl bg-surface p-6 text-ink shadow-raised">
              <WaitlistForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
