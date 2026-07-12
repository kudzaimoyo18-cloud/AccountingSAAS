// Display formatting helpers. Money uses tabular figures (.tnum) at the call site.

import { REGIONS } from "./regions";
import type { Region } from "./types";

export function money(amount: number, region: Region, opts?: { sign?: boolean }): string {
  const cfg = REGIONS[region];
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  if (opts?.sign && amount !== 0) return `${amount < 0 ? "−" : "+"}${formatted}`;
  return amount < 0 ? `−${formatted}` : formatted;
}

/** Money with exact cents/fils — invoices and formal documents. */
export function moneyExact(amount: number, region: Region): string {
  const cfg = REGIONS[region];
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return amount < 0 ? `−${formatted}` : formatted;
}

export function compactMoney(amount: number, region: Region): string {
  const cfg = REGIONS[region];
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function shortDate(iso: string, region: Region): string {
  return new Date(iso).toLocaleDateString(REGIONS[region].locale, {
    day: "numeric",
    month: "short",
  });
}

export function longDate(iso: string, region: Region): string {
  return new Date(iso).toLocaleDateString(REGIONS[region].locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
