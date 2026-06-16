// Domain types for the real, persisted bookkeeping engine.
// DB stores amounts POSITIVE with a `direction` flag (unlike the demo's signed
// convention). numeric columns come back from supabase-js as strings — fromRow
// normalises them.

import type { Region } from "@/lib/demo/types";

export type { Region };
export type Direction = "in" | "out";
export type TxnStatus = "posted" | "review" | "uncategorized";
export type TxnSource = "rule" | "ai" | "manual" | "import" | "seed";

/** A raw bank line before categorisation. amount is gross and positive. */
export interface RawLine {
  date: string; // ISO yyyy-mm-dd
  description: string;
  counterparty: string;
  amount: number; // positive gross
  direction: Direction;
}

/** Result of categorising one line. */
export interface Suggestion {
  accountCode: string;
  category: string;
  vatRate: number; // 0, 0.05, 0.2
  confidence: number; // 0..1
  reason: string;
  source: TxnSource; // rule | ai | manual
}

/** Normalised transaction used across the engine and UI. */
export interface Txn {
  id: string;
  date: string;
  description: string;
  counterparty: string | null;
  amount: number; // positive gross
  direction: Direction;
  accountCode: string | null;
  category: string | null;
  vatRate: number;
  vatAmount: number; // positive
  net: number; // positive
  status: TxnStatus;
  confidence: number | null;
  source: TxnSource;
  reason: string | null;
}

/** Exact row shape returned by supabase for the transactions table. */
export interface TxnRow {
  id: string;
  txn_date: string;
  description: string;
  counterparty: string | null;
  amount: number | string;
  direction: Direction;
  account_code: string | null;
  category: string | null;
  vat_rate: number | string;
  vat_amount: number | string;
  net_amount: number | string;
  status: TxnStatus;
  confidence: number | string | null;
  source: TxnSource;
  reason: string | null;
}

export function fromRow(r: TxnRow): Txn {
  return {
    id: r.id,
    date: r.txn_date,
    description: r.description,
    counterparty: r.counterparty,
    amount: num(r.amount),
    direction: r.direction,
    accountCode: r.account_code,
    category: r.category,
    vatRate: num(r.vat_rate),
    vatAmount: num(r.vat_amount),
    net: num(r.net_amount),
    status: r.status,
    confidence: r.confidence == null ? null : num(r.confidence),
    source: r.source,
    reason: r.reason,
  };
}

function num(v: number | string): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
