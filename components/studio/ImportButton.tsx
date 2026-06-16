"use client";

import { useStudio } from "./StudioProvider";
import { statementMonth } from "@/lib/demo/statement";

export function ImportButton({ compact = false }: { compact?: boolean }) {
  const { region, importing, imported, progress, importStatement } = useStudio();
  const month = statementMonth(region);

  if (imported && !importing) {
    return (
      <span className="badge bg-evergreen/10 text-evergreen px-3 py-1.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {month} imported
      </span>
    );
  }

  if (importing) {
    const w = progress.total ? (progress.done / progress.total) * 100 : 0;
    return (
      <div className={`flex items-center gap-3 ${compact ? "" : "min-w-[15rem]"}`}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass/60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brass" />
        </span>
        <div className="flex-1">
          <div className="flex justify-between text-xs text-ink-soft">
            <span>Categorising…</span>
            <span className="tnum">{progress.done}/{progress.total}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper-dim">
            <div className="h-full rounded-full bg-brass transition-all duration-200" style={{ width: `${w}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={importStatement} className="btn-primary">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Import {month} statement
    </button>
  );
}
