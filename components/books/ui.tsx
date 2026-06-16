import { pct } from "@/lib/demo/format";

const INCOME_PREFIX = "4";

export function CategoryBadge({ category, code }: { category: string | null; code: string | null }) {
  if (!category) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-ink-soft">
        Uncategorised
      </span>
    );
  }
  const isIncome = code?.startsWith(INCOME_PREFIX);
  const cls = isIncome
    ? "border-evergreen/30 bg-evergreen/10 text-evergreen"
    : "border-brass/30 bg-brass/10 text-brass-deep";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <span className="tnum opacity-60">{code}</span>
      {category}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    posted: "border-evergreen/30 bg-evergreen/10 text-evergreen",
    review: "border-brass/40 bg-brass/10 text-brass-deep",
    uncategorized: "border-line bg-paper-dim text-ink-soft",
  };
  const label: Record<string, string> = {
    posted: "Posted",
    review: "Needs review",
    uncategorized: "Uncategorised",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[status] ?? map.uncategorized}`}>
      {label[status] ?? status}
    </span>
  );
}

export function ConfidenceMeter({ value }: { value: number | null }) {
  if (value == null) return null;
  const width = Math.round(value * 100);
  const tone = value >= 0.8 ? "bg-evergreen" : value >= 0.6 ? "bg-brass" : "bg-danger";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-paper-dim">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </span>
      <span className="tnum text-xs text-ink-soft">{pct(value)}</span>
    </span>
  );
}
