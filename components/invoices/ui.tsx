export function InvoiceStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "border-line bg-paper-dim text-ink-soft",
    sent: "border-brass/40 bg-brass/10 text-brass-deep",
    paid: "border-evergreen/30 bg-evergreen/10 text-evergreen",
    void: "border-line bg-paper-dim text-ink-soft line-through",
  };
  const label: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    paid: "Paid",
    void: "Void",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[status] ?? map.draft}`}
    >
      {label[status] ?? status}
    </span>
  );
}
