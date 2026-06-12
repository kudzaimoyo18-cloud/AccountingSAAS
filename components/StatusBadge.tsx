const STYLES: Record<string, string> = {
  filed: "bg-evergreen/10 text-evergreen",
  in_progress: "bg-brass/10 text-brass-deep",
  upcoming: "bg-paper-dim text-ink-soft",
  overdue: "bg-danger/10 text-danger",
  new: "bg-brass/10 text-brass-deep",
  processed: "bg-evergreen/10 text-evergreen",
  active: "bg-evergreen/10 text-evergreen",
  onboarding: "bg-brass/10 text-brass-deep",
  paused: "bg-paper-dim text-ink-soft",
};

const LABELS: Record<string, string> = {
  filed: "Filed",
  in_progress: "In progress",
  upcoming: "Upcoming",
  overdue: "Overdue",
  new: "New",
  processed: "Processed",
  active: "Active",
  onboarding: "Onboarding",
  paused: "Paused",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STYLES[status] ?? "bg-paper-dim text-ink-soft"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status] ?? status}
    </span>
  );
}
