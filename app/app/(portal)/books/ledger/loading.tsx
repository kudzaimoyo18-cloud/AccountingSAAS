// The ledger loads every entry plus the documents list — skeleton the toolbar,
// totals, and a few table rows so navigating in feels instant.
export default function LedgerLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" aria-hidden>
      <div className="h-9 w-full max-w-md rounded-full bg-paper-dim" />
      <div className="mt-5 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-paper-dim" />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-paper-dim" />
        ))}
      </div>
      <div className="mt-5 space-y-2 rounded-2xl border border-line bg-surface p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-paper-dim/70" />
        ))}
      </div>
    </div>
  );
}
