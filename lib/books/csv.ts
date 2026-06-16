// Bank-statement CSV parsing. Bank exports vary wildly, so we parse with
// papaparse (handles quoting/commas-in-fields) then auto-detect the date /
// description / amount columns. The user can override the guess before import.

import Papa from "papaparse";
import type { Direction, RawLine } from "./types";

export interface ColumnMap {
  date: string;
  description: string;
  amount: string | null; // single signed-amount column
  debit: string | null; // separate "money out" column
  credit: string | null; // separate "money in" column
  counterparty: string | null;
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const rows = (result.data ?? []).filter(
    (r) => r && Object.values(r).some((v) => String(v ?? "").trim() !== ""),
  );
  const headers = result.meta.fields?.map((h) => h.trim()) ?? (rows[0] ? Object.keys(rows[0]) : []);
  return { headers, rows };
}

const DATE_HINTS = ["date", "posted", "value date", "transaction date"];
const DESC_HINTS = ["description", "details", "narrative", "memo", "reference", "particulars", "transaction"];
const AMOUNT_HINTS = ["amount", "value"];
const DEBIT_HINTS = ["debit", "withdrawal", "paid out", "money out", "out", "dr"];
const CREDIT_HINTS = ["credit", "deposit", "paid in", "money in", "in", "cr"];
const PARTY_HINTS = ["payee", "counterparty", "merchant", "name", "to / from", "beneficiary"];

function pick(headers: string[], hints: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const hint of hints) {
    const i = lower.findIndex((h) => h === hint);
    if (i >= 0) return headers[i];
  }
  for (const hint of hints) {
    const i = lower.findIndex((h) => h.includes(hint));
    if (i >= 0) return headers[i];
  }
  return null;
}

export function guessMapping(headers: string[]): ColumnMap {
  const debit = pick(headers, DEBIT_HINTS);
  const credit = pick(headers, CREDIT_HINTS);
  return {
    date: pick(headers, DATE_HINTS) ?? headers[0] ?? "",
    description: pick(headers, DESC_HINTS) ?? headers[1] ?? "",
    amount: debit && credit ? null : pick(headers, AMOUNT_HINTS),
    debit,
    credit,
    counterparty: pick(headers, PARTY_HINTS),
  };
}

/** Convert parsed rows into normalised RawLines using the column mapping. */
export function toLines(rows: Record<string, string>[], map: ColumnMap): RawLine[] {
  const out: RawLine[] = [];
  for (const row of rows) {
    const date = normalizeDate(String(row[map.date] ?? "").trim());
    const description = String(row[map.description] ?? "").trim();
    if (!date || !description) continue;

    let amount = 0;
    let direction: Direction = "out";

    if (map.amount) {
      const signed = parseAmount(row[map.amount]);
      if (signed === null) continue;
      direction = signed < 0 ? "out" : "in";
      amount = Math.abs(signed);
    } else {
      const debit = map.debit ? parseAmount(row[map.debit]) : null;
      const credit = map.credit ? parseAmount(row[map.credit]) : null;
      if (credit && credit !== 0) {
        direction = "in";
        amount = Math.abs(credit);
      } else if (debit && debit !== 0) {
        direction = "out";
        amount = Math.abs(debit);
      } else {
        continue;
      }
    }

    if (amount === 0) continue;
    const counterparty = map.counterparty ? String(row[map.counterparty] ?? "").trim() : "";
    out.push({ date, description, counterparty, amount, direction });
  }
  return out;
}

/** Parse a money string like "1,234.50", "(50.00)", "AED 90" → number. */
export function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.includes("-");
  s = s.replace(/[()]/g, "").replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** Normalise a date string to ISO yyyy-mm-dd. Handles ISO, DD/MM/YYYY,
 * MM/DD/YYYY (ambiguous → day-first), and DD-MMM-YYYY. */
export function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  // already ISO
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD/MM/YYYY or DD-MM-YYYY (day-first; UK/UAE bank default)
  const dmy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    const dd = d.padStart(2, "0");
    const mm = m.padStart(2, "0");
    if (Number(mm) > 12) return null;
    return `${y}-${mm}-${dd}`;
  }

  // DD-MMM-YYYY (e.g. 04-Jun-2026)
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}
