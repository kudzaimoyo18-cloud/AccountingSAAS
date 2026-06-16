// The "magic moment" data: a fresh, uncategorised bank statement the user imports
// live during the demo. Two ambiguous lines per region fall below the review
// threshold on purpose, so the human-review queue lights up.

import type { RawLine } from "./seed";
import type { Region } from "./types";

const STATEMENTS: Record<Region, RawLine[]> = {
  ae: [
    { date: "2026-06-08", description: "INV-2052 payment received", counterparty: "Gulf Mart LLC", amount: 44200 },
    { date: "2026-06-09", description: "Supplier settlement", counterparty: "Shenzhen Trading Co", amount: -19800 },
    { date: "2026-06-10", description: "Office rent — June", counterparty: "Emaar Properties", amount: -12000 },
    { date: "2026-06-11", description: "Meta Ads", counterparty: "Meta Platforms", amount: -2750 },
    { date: "2026-06-12", description: "Salaries — June (WPS)", counterparty: "WPS Payroll", amount: -28400 },
    { date: "2026-06-12", description: "TRANSFER TO 8841", counterparty: "—", amount: -5000 },
    { date: "2026-06-13", description: "AWS cloud services", counterparty: "Amazon Web Services", amount: -1180 },
    { date: "2026-06-13", description: "Careem rides", counterparty: "Careem Networks", amount: -260 },
    { date: "2026-06-14", description: "MISC PURCHASE 4471", counterparty: "POS Terminal", amount: -940 },
  ],
  gb: [
    { date: "2026-06-05", description: "Shopify payout", counterparty: "Shopify Payments", amount: 5980 },
    { date: "2026-06-06", description: "Stock purchase", counterparty: "Northern Wholesale Ltd", amount: -2540 },
    { date: "2026-06-07", description: "Studio rent — June", counterparty: "Bruntwood", amount: -1450 },
    { date: "2026-06-08", description: "Meta Ads", counterparty: "Meta Platforms", amount: -540 },
    { date: "2026-06-09", description: "Wages — June", counterparty: "PAYE Payroll", amount: -3960 },
    { date: "2026-06-09", description: "TRANSFER TO 8841", counterparty: "—", amount: -800 },
    { date: "2026-06-10", description: "Trainline ticket", counterparty: "Trainline", amount: -76 },
    { date: "2026-06-10", description: "Stripe payout", counterparty: "Stripe Payments UK", amount: 3920 },
    { date: "2026-06-11", description: "CARD PURCHASE 2290", counterparty: "Contactless", amount: -118 },
  ],
};

export function statementFor(region: Region): RawLine[] {
  return STATEMENTS[region];
}

export function statementMonth(region: Region): string {
  return "June 2026";
}
