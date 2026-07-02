// Shown in the content area while the next page segment loads. Because the shell
// layout stays mounted, only this skeleton swaps in — tab switches feel instant.
export default function PortalLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse" aria-hidden>
      <div className="h-8 w-56 rounded-lg bg-paper-dim" />
      <div className="mt-3 h-4 w-72 rounded bg-paper-dim/70" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-paper-dim" />
        <div className="h-24 rounded-2xl bg-paper-dim" />
        <div className="h-24 rounded-2xl bg-paper-dim" />
      </div>
      <div className="mt-8 h-64 rounded-2xl bg-paper-dim" />
    </div>
  );
}
