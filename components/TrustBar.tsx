const ZONES = ["IFZA", "DMCC", "Meydan", "SHAMS", "RAKEZ", "DAFZA"];

export function TrustBar() {
  return (
    <section className="border-y border-line bg-paper-dim/60">
      <div className="shell flex flex-col items-center gap-5 py-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-ink-soft">
          Built for companies across the UAE&apos;s free zones
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {ZONES.map((z) => (
            <li
              key={z}
              className="font-display text-base font-medium tracking-wide text-ink/70"
            >
              {z}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
