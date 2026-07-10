const STYLES: Record<string, string> = {
  filed: "bg-evergreen/10 text-evergreen",
  in_progress: "bg-warning/10 text-warning",
  upcoming: "bg-paper-dim text-ink-soft",
  overdue: "bg-danger/10 text-danger",
  new: "bg-warning/10 text-warning",
  processed: "bg-evergreen/10 text-evergreen",
  active: "bg-evergreen/10 text-evergreen",
  onboarding: "bg-warning/10 text-warning",
  paused: "bg-paper-dim text-ink-soft",
  draft: "bg-paper-dim text-ink-soft",
  reviewed: "bg-warning/10 text-warning",
  approved: "bg-evergreen/10 text-evergreen",
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
  draft: "AI draft",
  reviewed: "Reviewed",
  approved: "Approved",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STYLES[status] ?? "bg-paper-dim text-ink-soft"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status] ?? status}
    </span>
  );
}
