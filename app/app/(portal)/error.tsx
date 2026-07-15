"use client";

// Portal error boundary: if a page throws (a failed query, a bad render), a real
// user sees this instead of a broken screen. "Try again" re-runs the segment.
import { useEffect } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal] render error:", error.message, error.digest);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger/10 text-danger">
        <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M8 1 1 14h14zM8 6v3.5M8 12h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-4 text-lg font-extrabold text-ink">Something went wrong</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        This page hit an error — your data is safe. Try again, and if it keeps
        happening let us know.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/app" className="btn-ghost">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
