"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { parseCsv, guessMapping, type ColumnMap } from "@/lib/books/csv";
import { importStatement } from "@/lib/books/actions";

type Mode = "single" | "split";

export function ImportWizard() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [rowCount, setRowCount] = useState<number>(0);
  const [mode, setMode] = useState<Mode>("single");
  const [map, setMap] = useState<ColumnMap>({
    date: "",
    description: "",
    amount: null,
    debit: null,
    credit: null,
    counterparty: null,
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    const guess = guessMapping(headers);
    setHeaders(headers);
    setPreview(rows.slice(0, 5));
    setRowCount(rows.length);
    setMap(guess);
    setMode(guess.amount ? "single" : "split");
  }

  const finalMap: ColumnMap =
    mode === "single"
      ? { ...map, debit: null, credit: null }
      : { ...map, amount: null };

  const ready =
    headers.length > 0 &&
    map.date &&
    map.description &&
    (mode === "single" ? Boolean(map.amount) : Boolean(map.debit || map.credit));

  return (
    <form action={importStatement} className="mt-6 space-y-6">
      <div className="card">
        <label htmlFor="file" className="mb-2 block text-sm font-medium">
          Bank statement (CSV)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={handleFile}
          className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-evergreen file:px-4 file:py-2 file:text-sm file:font-medium file:text-sidebar hover:file:bg-evergreen-deep"
        />
        <p className="mt-2 text-xs text-ink-soft">
          Export a statement from your bank as CSV. We read the columns in your browser — nothing is
          uploaded until you confirm the mapping.
        </p>
      </div>

      {headers.length > 0 && (
        <>
          <div className="card">
            <h2 className="font-display text-base font-semibold">Map your columns</h2>
            <p className="mt-1 text-xs text-ink-soft">
              We&apos;ve guessed these from <span className="font-medium">{fileName}</span>. Adjust if needed.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Date column">
                <ColumnSelect headers={headers} value={map.date} onChange={(v) => setMap({ ...map, date: v })} />
              </Field>
              <Field label="Description column">
                <ColumnSelect headers={headers} value={map.description} onChange={(v) => setMap({ ...map, description: v })} />
              </Field>
              <Field label="Payee / source (optional)">
                <ColumnSelect headers={headers} value={map.counterparty ?? ""} onChange={(v) => setMap({ ...map, counterparty: v || null })} allowNone />
              </Field>

              <Field label="Amount layout">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  className="field"
                >
                  <option value="single">One signed amount column</option>
                  <option value="split">Separate money-in / money-out</option>
                </select>
              </Field>

              {mode === "single" ? (
                <Field label="Amount column">
                  <ColumnSelect headers={headers} value={map.amount ?? ""} onChange={(v) => setMap({ ...map, amount: v || null })} allowNone />
                </Field>
              ) : (
                <>
                  <Field label="Money out (debit)">
                    <ColumnSelect headers={headers} value={map.debit ?? ""} onChange={(v) => setMap({ ...map, debit: v || null })} allowNone />
                  </Field>
                  <Field label="Money in (credit)">
                    <ColumnSelect headers={headers} value={map.credit ?? ""} onChange={(v) => setMap({ ...map, credit: v || null })} allowNone />
                  </Field>
                </>
              )}
            </div>
          </div>

          <div className="card overflow-x-auto">
            <h2 className="font-display text-base font-semibold">Preview</h2>
            <table className="mt-3 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-ink-soft">
                  {headers.map((h) => (
                    <th key={h} className="px-2 py-1.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} className="tnum px-2 py-1.5 text-ink-soft">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <input type="hidden" name="mapping" value={JSON.stringify(finalMap)} />
          <SubmitBar ready={Boolean(ready)} rowCount={rowCount} />
        </>
      )}
    </form>
  );
}

const IMPORT_STAGES = [
  "Reading your statement…",
  "Matching against your saved rules…",
  "Categorising transactions…",
  "Double-checking the low-confidence lines…",
  "Posting to your ledger…",
];

function SubmitBar({ ready, rowCount }: { ready: boolean; rowCount: number }) {
  const { pending } = useFormStatus();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!pending) {
      setStage(0);
      return;
    }
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, IMPORT_STAGES.length - 1));
    }, 850);
    return () => clearInterval(id);
  }, [pending]);

  if (!pending) {
    return (
      <button type="submit" disabled={!ready} className="btn-primary disabled:opacity-40">
        Import &amp; categorise
      </button>
    );
  }

  return (
    <div className="space-y-2.5" role="status" aria-live="polite" aria-busy="true">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/60">
        <div className="mz-indeterminate h-full w-1/3 rounded-full bg-evergreen" />
      </div>
      <p className="text-sm text-ink-soft">
        {IMPORT_STAGES[stage]}
        {rowCount > 0 && <span className="text-ink-soft/70"> · {rowCount} rows</span>}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

function ColumnSelect({
  headers,
  value,
  onChange,
  allowNone = false,
}: {
  headers: string[];
  value: string;
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
      {allowNone && <option value="">— none —</option>}
      {!allowNone && !value && <option value="">Select…</option>}
      {headers.map((h) => (
        <option key={h} value={h}>{h}</option>
      ))}
    </select>
  );
}
