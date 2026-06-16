// Seeded sample books per region + the converter that turns a raw bank line into
// a fully-formed Transaction by running the categorisation engine.

import { categorize, splitVat, REVIEW_THRESHOLD } from "./categorize";
import { REGIONS } from "./regions";
import type { Region, Transaction, TxnSource } from "./types";

export interface RawLine {
  date: string;
  description: string;
  counterparty: string;
  amount: number; // signed gross
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** Convert a raw bank line into a categorised Transaction. */
export function makeTxn(
  line: RawLine,
  region: Region,
  source: TxnSource,
  opts?: { forcePosted?: boolean },
): Transaction {
  const direction = line.amount >= 0 ? "in" : "out";
  const sug = categorize(
    line.description,
    line.counterparty,
    direction,
    region,
    REGIONS[region].vatRate,
  );
  const { net, vat } = splitVat(line.amount, sug.vatRate);
  const posted = opts?.forcePosted || sug.confidence >= REVIEW_THRESHOLD;

  return {
    id: nextId(`${region}-${source}`),
    date: line.date,
    description: line.description,
    counterparty: line.counterparty,
    amount: line.amount,
    direction,
    accountCode: sug.accountCode,
    category: sug.category,
    vatRate: sug.vatRate,
    vatAmount: vat,
    net,
    status: posted ? "posted" : "review",
    confidence: sug.confidence,
    source,
    reason: sug.reason,
  };
}

const SEED_LINES: Record<Region, RawLine[]> = {
  ae: [
    { date: "2026-04-03", description: "INV-2041 payment received", counterparty: "Gulf Mart LLC", amount: 48500 },
    { date: "2026-04-05", description: "Supplier settlement", counterparty: "Shenzhen Trading Co", amount: -21200 },
    { date: "2026-04-07", description: "Office rent — April", counterparty: "Emaar Properties", amount: -12000 },
    { date: "2026-04-09", description: "Google Workspace", counterparty: "Google Cloud EMEA", amount: -420 },
    { date: "2026-04-12", description: "Careem rides", counterparty: "Careem Networks", amount: -380 },
    { date: "2026-04-15", description: "Salaries — April (WPS)", counterparty: "WPS Payroll", amount: -28400 },
    { date: "2026-04-18", description: "INV-2042 payment received", counterparty: "Al Noor Retail", amount: 31750 },
    { date: "2026-04-20", description: "DEWA utility bill", counterparty: "DEWA", amount: -1640 },
    { date: "2026-04-22", description: "Meta Ads", counterparty: "Meta Platforms", amount: -3200 },
    { date: "2026-04-26", description: "Stripe payout", counterparty: "Stripe Payments", amount: 12940 },
    { date: "2026-04-28", description: "Bank commission", counterparty: "Emirates NBD", amount: -180 },
    { date: "2026-05-02", description: "INV-2045 payment received", counterparty: "Gulf Mart LLC", amount: 52600 },
    { date: "2026-05-04", description: "Supplier settlement", counterparty: "Guangzhou Imports", amount: -24800 },
    { date: "2026-05-06", description: "Office rent — May", counterparty: "Emaar Properties", amount: -12000 },
    { date: "2026-05-10", description: "Salaries — May (WPS)", counterparty: "WPS Payroll", amount: -28400 },
    { date: "2026-05-13", description: "Adobe Creative Cloud", counterparty: "Adobe Systems", amount: -610 },
    { date: "2026-05-16", description: "Salik toll top-up", counterparty: "Salik", amount: -200 },
    { date: "2026-05-19", description: "INV-2048 payment received", counterparty: "Marina Hotels", amount: 27300 },
    { date: "2026-05-23", description: "Etisalat business line", counterparty: "Etisalat", amount: -890 },
    { date: "2026-05-27", description: "Legal retainer", counterparty: "Hadef & Partners", amount: -4500 },
    { date: "2026-06-01", description: "Client lunch — restaurant", counterparty: "Zuma Dubai", amount: -640 },
    { date: "2026-06-04", description: "INV-2051 payment received", counterparty: "Al Noor Retail", amount: 38900 },
  ],
  gb: [
    { date: "2026-04-02", description: "Shopify payout", counterparty: "Shopify Payments", amount: 6240 },
    { date: "2026-04-04", description: "Stock purchase", counterparty: "Northern Wholesale Ltd", amount: -2820 },
    { date: "2026-04-06", description: "Studio rent — April", counterparty: "Bruntwood", amount: -1450 },
    { date: "2026-04-08", description: "Google Workspace", counterparty: "Google Cloud UK", amount: -72 },
    { date: "2026-04-11", description: "Trainline ticket", counterparty: "Trainline", amount: -88 },
    { date: "2026-04-14", description: "Wages — April", counterparty: "PAYE Payroll", amount: -3960 },
    { date: "2026-04-17", description: "Stripe payout", counterparty: "Stripe Payments UK", amount: 4180 },
    { date: "2026-04-19", description: "British Gas — electricity", counterparty: "British Gas", amount: -240 },
    { date: "2026-04-22", description: "Meta Ads", counterparty: "Meta Platforms", amount: -610 },
    { date: "2026-04-25", description: "Amazon — packaging supplies", counterparty: "Amazon UK", amount: -312 },
    { date: "2026-04-28", description: "Bank service charge", counterparty: "Barclays", amount: -28 },
    { date: "2026-05-01", description: "Shopify payout", counterparty: "Shopify Payments", amount: 7110 },
    { date: "2026-05-03", description: "Stock purchase", counterparty: "Northern Wholesale Ltd", amount: -3340 },
    { date: "2026-05-06", description: "Studio rent — May", counterparty: "Bruntwood", amount: -1450 },
    { date: "2026-05-09", description: "Wages — May", counterparty: "PAYE Payroll", amount: -3960 },
    { date: "2026-05-12", description: "Adobe Creative Cloud", counterparty: "Adobe UK", amount: -52 },
    { date: "2026-05-15", description: "Stripe payout", counterparty: "Stripe Payments UK", amount: 5260 },
    { date: "2026-05-18", description: "BT broadband", counterparty: "BT Business", amount: -64 },
    { date: "2026-05-21", description: "Accountant fees", counterparty: "Meridian & Co", amount: -350 },
    { date: "2026-05-24", description: "Team coffee", counterparty: "Costa Coffee", amount: -36 },
    { date: "2026-05-28", description: "Shopify payout", counterparty: "Shopify Payments", amount: 6890 },
    { date: "2026-06-02", description: "Stock purchase", counterparty: "Northern Wholesale Ltd", amount: -2980 },
  ],
};

/** Fully-categorised, already-posted opening books for a region. */
export function buildSeed(region: Region): Transaction[] {
  return SEED_LINES[region].map((line) =>
    makeTxn(line, region, "seed", { forcePosted: true }),
  );
}
