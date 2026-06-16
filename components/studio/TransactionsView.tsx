"use client";

import { useState } from "react";
import { useStudio } from "./StudioProvider";
import { ImportButton } from "./ImportButton";
import { CategoryBadge, ConfidenceMeter, StatusPill } from "./ui";
import { money, shortDate } from "@/lib/demo/format";
import type { TxnStatus } from "@/lib/demo/types";

type Filter = "all" | "posted" | "review";

export function TransactionsView() {
  const { region, transactions, reports, flashId } = useStudio();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = transactions.filter((t) =>
    filter === "all" ? true : filter === "review" ? t.status === "review" : t.status === "posted",
  );

  const tabs: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: reports.totalCount },
    { key: "posted", label: "Posted", n: reports.postedCount },
    { key: "review", label: "Needs review", n: reports.reviewCount },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Bank feed</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every line ingested, categorised, and VAT-split automatically.
          </p>
        </div>
        <ImportButton />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={
              filter === t.key
                ? "rounded-full border border-brass bg-brass/10 px-3.5 py-1.5 text-xs font-medium text-brass-deep"
                : "rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
            }
          >
            {t.label} · {t.n}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Description</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Category</th>
              <th className="hidden px-5 py-3 font-medium lg:table-cell">Confidence</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr
                key={t.id}
                className={`border-b border-line/60 last:border-0 transition-colors ${
                  flashId === t.id ? "bg-brass/10" : "hover:bg-paper-dim/50"
                }`}
              >
                <td className="tnum whitespace-nowrap px-5 py-3.5 text-ink-soft">
                  {shortDate(t.date, region)}
                </td>
                <td className="px-5 py-3.5">
                  <p className="font-medium text-ink">{t.description}</p>
                  <p className="text-xs text-ink-soft">{t.counterparty}</p>
                  <div className="mt-1.5 md:hidden">
                    <CategoryBadge category={t.category} code={t.accountCode} />
                  </div>
                </td>
                <td className="hidden px-5 py-3.5 md:table-cell">
                  <CategoryBadge category={t.category} code={t.accountCode} />
                  {t.status === "review" && (
                    <div className="mt-1.5">
                      <StatusPill status={t.status as TxnStatus} />
                    </div>
                  )}
                </td>
                <td className="hidden px-5 py-3.5 lg:table-cell">
                  <ConfidenceMeter value={t.confidence} />
                </td>
                <td
                  className={`tnum whitespace-nowrap px-5 py-3.5 text-right font-medium ${
                    t.direction === "in" ? "text-evergreen" : "text-ink"
                  }`}
                >
                  {money(t.amount, region, { sign: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
