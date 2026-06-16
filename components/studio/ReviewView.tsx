"use client";

import { useStudio } from "./StudioProvider";
import { CategoryBadge, ConfidenceMeter } from "./ui";
import { money, shortDate } from "@/lib/demo/format";
import { selectableAccounts } from "@/lib/demo/coa";

export function ReviewView() {
  const { region, transactions, approve, reassign } = useStudio();
  const queue = transactions.filter((t) => t.status === "review");
  const accounts = selectableAccounts(region);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Human-in-the-loop</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Review queue</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">
          Mizan posts everything it&apos;s confident about and surfaces only the edge cases.
          You stay in control of the books — approve or re-assign in one click.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-evergreen/10 text-evergreen">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12.5 10 17l9-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-4 font-display text-xl font-semibold">Queue clear</p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">
            Nothing needs your attention. Import a statement to watch new edge cases land here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((t) => (
            <div key={t.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink">{t.description}</p>
                    <span className="tnum text-xs text-ink-soft">· {shortDate(t.date, region)}</span>
                  </div>
                  <p className="text-xs text-ink-soft">{t.counterparty}</p>
                  <p className="mt-3 max-w-md text-xs italic text-ink-soft">
                    “{t.reason}”
                  </p>
                </div>
                <span
                  className={`tnum whitespace-nowrap font-display text-xl font-semibold ${
                    t.direction === "in" ? "text-evergreen" : "text-ink"
                  }`}
                >
                  {money(t.amount, region, { sign: true })}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
                <span className="text-xs text-ink-soft">Suggested:</span>
                <CategoryBadge category={t.category} code={t.accountCode} />
                <ConfidenceMeter value={t.confidence} />

                <div className="ml-auto flex items-center gap-2">
                  <select
                    aria-label="Re-assign account"
                    defaultValue={t.accountCode ?? ""}
                    onChange={(e) => reassign(t.id, e.target.value)}
                    className="rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-brass focus:outline-none"
                  >
                    {accounts.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => approve(t.id)} className="btn-primary px-5 py-2">
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
