// Reports pulls the full trial balance / P&L / balance sheet — the heaviest read
// in the app. Show a shaped skeleton so the page doesn't flash empty.
export default function ReportsLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" aria-hidden>
      <div className="flex items-end justify-between border-b border-line pb-5">
        <div className="h-4 w-64 rounded bg-paper-dim/70" />
        <div className="h-8 w-24 rounded-full bg-paper-dim" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-paper-dim" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-2xl bg-paper-dim" />
        <div className="h-80 rounded-2xl bg-paper-dim" />
      </div>
    </div>
  );
}
