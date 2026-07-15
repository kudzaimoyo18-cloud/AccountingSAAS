// Shown in the content area while the next page segment loads. The shell layout
// stays mounted, so only this skeleton swaps in — tab switches feel instant.
// Responsive: a compact stack on phones, the wider grid on desktop.
export default function PortalLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse" aria-hidden>
      <div className="h-7 w-40 rounded-lg bg-paper-dim sm:h-8 sm:w-56" />
      <div className="mt-3 h-4 w-56 rounded bg-paper-dim/70 sm:w-72" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-paper-dim" />
        ))}
      </div>
      <div className="mt-4 h-56 rounded-2xl bg-paper-dim sm:h-64" />
    </div>
  );
}
