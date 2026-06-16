// Small presentational primitives shared across the Studio views.

import { pct } from "@/lib/demo/format";

export function CategoryBadge({ category, code }: { category: string | null; code: string | null }) {
  if (!category) {
    return (
      <span className="badge bg-paper-dim text-ink-soft">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-soft/50" />
        Uncategorised
      </span>
    );
  }
  const income = code != null && code.startsWith("4");
  const tone = income ? "bg-evergreen/10 text-evergreen" : "bg-brass/10 text-brass-deep";
  const dot = income ? "bg-evergreen" : "bg-brass";
  return (
    <span className={`badge ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {category}
    </span>
  );
}

export function ConfidenceMeter({ value }: { value: number | null }) {
  if (value === null) return null;
  const high = value >= 0.8;
  const color = high ? "bg-evergreen" : "bg-brass";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-paper-dim">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="tnum text-xs text-ink-soft">{pct(value)}</span>
    </span>
  );
}

export function StatusPill({ status }: { status: "posted" | "review" | "uncategorized" }) {
  if (status === "posted") {
    return (
      <span className="badge bg-evergreen/10 text-evergreen">
        <Check /> Posted
      </span>
    );
  }
  if (status === "review") {
    return (
      <span className="badge bg-brass/10 text-brass-deep">
        <Dot /> Needs review
      </span>
    );
  }
  return (
    <span className="badge bg-paper-dim text-ink-soft">
      <Dot /> New
    </span>
  );
}

/** Tiny dependency-free bar sparkline from monthly profit points. */
export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length === 0) return null;
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  return (
    <span className={`inline-flex items-end gap-1 ${className}`} aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="w-2 rounded-sm bg-brass/70"
          style={{ height: `${Math.max(8, (Math.abs(v) / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

function Check() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-current" />;
}
