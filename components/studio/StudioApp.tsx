"use client";

import { useState } from "react";
import { StudioProvider, useStudio } from "./StudioProvider";
import { StudioShell, type Tab } from "./StudioShell";
import { Dashboard } from "./Dashboard";
import { TransactionsView } from "./TransactionsView";
import { ReviewView } from "./ReviewView";
import { ReportsView } from "./ReportsView";

export function StudioApp() {
  return (
    <StudioProvider>
      <StudioInner />
    </StudioProvider>
  );
}

function StudioInner() {
  const [tab, setTab] = useState<Tab>("overview");
  const { importSummary, dismissSummary } = useStudio();

  return (
    <StudioShell active={tab} onNavigate={setTab}>
      {tab === "overview" && <Dashboard onGoReview={() => setTab("review")} />}
      {tab === "transactions" && <TransactionsView />}
      {tab === "review" && <ReviewView />}
      {tab === "reports" && <ReportsView />}

      {importSummary && (
        <ImportToast
          imported={importSummary.imported}
          posted={importSummary.posted}
          review={importSummary.review}
          onReview={() => {
            setTab("review");
            dismissSummary();
          }}
          onDismiss={dismissSummary}
        />
      )}
    </StudioShell>
  );
}

function ImportToast({
  imported,
  posted,
  review,
  onReview,
  onDismiss,
}: {
  imported: number;
  posted: number;
  review: number;
  onReview: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rise fixed inset-x-4 bottom-5 z-50 mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-lift sm:inset-x-auto sm:right-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-evergreen/10 text-evergreen">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M4 10.5 8.5 15l8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">
            {imported} transactions imported
          </p>
          <p className="tnum mt-0.5 text-xs text-ink-soft">
            {posted} auto-posted · {review} flagged for review
          </p>
          {review > 0 && (
            <button onClick={onReview} className="mt-2 text-sm font-medium text-brass-deep hover:underline">
              Review {review} now →
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-ink-soft transition-colors hover:text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
