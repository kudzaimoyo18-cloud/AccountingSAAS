"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import {
  updateLedgerEntry,
  setLedgerStatus,
  deleteLedgerEntry,
} from "@/lib/books/ledger-actions";

// Stitch-style audit table: read-first rows, click a row to open the detail
// drawer where every field is editable and the review actions live.

export type LedgerRow = {
  id: string;
  entry_date: string | null;
  description: string | null;
  counterparty: string | null;
  category: string;
  direction: "income" | "expense";
  amount: number;
  vat_amount: number;
  currency: string | null;
  confidence: number | null;
  source: string;
  status: string;
  document_id: string | null;
};

const DIRECTIONS = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

function catLabel(c: string) {
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function money(n: number) {
  return n.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function LedgerTable({
  rows,
  categories,
}: {
  rows: LedgerRow[];
  categories: readonly string[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <>
      <div className="panel mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[860px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th className="num">Amount (AED)</th>
                <th className="num">VAT</th>
                <th>Category</th>
                <th>Status</th>
                <th className="text-center">Docs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const active = r.id === selectedId;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`cursor-pointer transition-colors ${
                      active ? "!bg-evergreen-soft/70" : ""
                    }`}
                    style={
                      active
                        ? { boxShadow: "inset 3px 0 0 0 rgb(var(--evergreen-rgb))" }
                        : undefined
                    }
                  >
                    <td className="tnum whitespace-nowrap text-ink-soft">
                      {shortDate(r.entry_date)}
                    </td>
                    <td>
                      <p className="font-medium text-ink">
                        {r.description || "(no description)"}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {r.counterparty ? `${r.counterparty} · ` : ""}
                        {r.source === "ai" ? "AI draft" : "Manual"}
                        {r.confidence != null &&
                          ` · ${Math.round(Number(r.confidence) * 100)}%`}
                      </p>
                    </td>
                    <td
                      className={`num font-medium ${
                        r.direction === "income" ? "text-evergreen" : ""
                      }`}
                    >
                      {r.direction === "income" ? "+" : "−"}
                      {money(Number(r.amount ?? 0))}
                    </td>
                    <td className="num text-ink-soft">
                      {money(Number(r.vat_amount ?? 0))}
                    </td>
                    <td>
                      <span className="badge badge-neutral whitespace-nowrap">
                        {catLabel(r.category)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-center">
                      {r.document_id ? (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-label="Has source document"
                          className="inline text-evergreen"
                        >
                          <path
                            d="M10.5 4.5 6 9a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 1 0-4-4l-5 5a4.2 4.2 0 0 0 6 6l4.5-4.5"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <span className="text-xs text-ink-soft/50">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* detail drawer */}
      {selected && (
        <>
          <button
            aria-label="Close line detail"
            onClick={() => setSelectedId(null)}
            className="fixed inset-0 z-40 cursor-default bg-ink/25 backdrop-blur-[2px]"
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[27rem] flex-col border-l border-line bg-surface shadow-lift"
            role="dialog"
            aria-label="Ledger line detail"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-ink">Line detail</h3>
                <StatusBadge status={selected.status} />
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="icon-btn"
                aria-label="Close"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="rounded-2xl bg-paper-dim/70 px-4 py-3">
                <p className="kpi-label">
                  {selected.direction === "income" ? "Income" : "Expense"} ·{" "}
                  {selected.currency ?? "AED"}
                </p>
                <p className="tnum mt-1 text-2xl font-semibold tracking-tight text-ink">
                  {money(Number(selected.amount ?? 0))}
                </p>
                <p className="tnum mt-0.5 text-xs text-ink-soft">
                  VAT {money(Number(selected.vat_amount ?? 0))} ·{" "}
                  {selected.source === "ai" ? "AI draft" : "Added by hand"}
                  {selected.confidence != null &&
                    ` · ${Math.round(Number(selected.confidence) * 100)}% confidence`}
                </p>
              </div>

              {selected.document_id && (
                <Link
                  href="/app/documents"
                  className="mt-3 flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-medium text-evergreen transition-colors hover:bg-evergreen-soft"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M10.5 4.5 6 9a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 1 0-4-4l-5 5a4.2 4.2 0 0 0 6 6l4.5-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  View source document
                </Link>
              )}

              {/* edit every field, then Save */}
              <form action={updateLedgerEntry} className="mt-5 space-y-3">
                <input type="hidden" name="id" value={selected.id} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="det-date">Date</label>
                    <input
                      id="det-date"
                      type="date"
                      name="entry_date"
                      defaultValue={selected.entry_date ?? ""}
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="det-dir">Direction</label>
                    <select
                      id="det-dir"
                      name="direction"
                      defaultValue={selected.direction}
                      className="field"
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="det-desc">Description</label>
                  <input
                    id="det-desc"
                    name="description"
                    defaultValue={selected.description ?? ""}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="det-cp">Counterparty</label>
                  <input
                    id="det-cp"
                    name="counterparty"
                    defaultValue={selected.counterparty ?? ""}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="det-cat">Category</label>
                  <select
                    id="det-cat"
                    name="category"
                    defaultValue={selected.category}
                    className="field"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {catLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label" htmlFor="det-amount">Net</label>
                    <input
                      id="det-amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      defaultValue={Number(selected.amount ?? 0)}
                      className="field tnum"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="det-vat">VAT</label>
                    <input
                      id="det-vat"
                      name="vat_amount"
                      type="number"
                      step="0.01"
                      defaultValue={Number(selected.vat_amount ?? 0)}
                      className="field tnum"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="det-cur">Currency</label>
                    <input
                      id="det-cur"
                      name="currency"
                      defaultValue={selected.currency ?? "AED"}
                      maxLength={8}
                      className="field uppercase"
                    />
                  </div>
                </div>
                <button type="submit" className="btn-ghost w-full">
                  Save changes
                </button>
              </form>

              {/* danger zone */}
              <form
                action={deleteLedgerEntry}
                onSubmit={(e) => {
                  if (!confirm("Delete this ledger line? This cannot be undone.")) {
                    e.preventDefault();
                  }
                }}
                className="mt-4 text-center"
              >
                <input type="hidden" name="id" value={selected.id} />
                <button
                  type="submit"
                  className="text-xs font-medium text-danger hover:underline"
                >
                  Delete line
                </button>
              </form>
            </div>

            {/* review actions — the Stitch drawer footer */}
            <div className="border-t border-line bg-paper-dim/50 px-5 py-4">
              <div className="flex gap-3">
                <form action={setLedgerStatus} className="flex-1">
                  <input type="hidden" name="id" value={selected.id} />
                  <input type="hidden" name="status" value="reviewed" />
                  <button type="submit" className="btn-ghost w-full">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M8 3.5c-3 0-5.3 1.9-6.5 4.5C2.7 10.6 5 12.5 8 12.5s5.3-1.9 6.5-4.5C13.3 5.4 11 3.5 8 3.5zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                    Mark reviewed
                  </button>
                </form>
                <form action={setLedgerStatus} className="flex-1">
                  <input type="hidden" name="id" value={selected.id} />
                  <input type="hidden" name="status" value="approved" />
                  <button type="submit" className="btn-primary w-full">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Approve
                  </button>
                </form>
              </div>
              {selected.status !== "draft" && (
                <form action={setLedgerStatus} className="mt-2 text-center">
                  <input type="hidden" name="id" value={selected.id} />
                  <input type="hidden" name="status" value="draft" />
                  <button
                    type="submit"
                    className="text-xs font-medium text-ink-soft hover:text-ink hover:underline"
                  >
                    Send back to draft
                  </button>
                </form>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
