// Deterministic categorisation engine. Maps a raw bank line to a chart-of-accounts
// code with a confidence score and a human-readable reason.
//
// This is the swap-point for a live LLM: keep the `categorize()` signature and
// route to an API instead. Deterministic is the default so the demo never breaks
// on stage. Confidence < REVIEW_THRESHOLD flags the line for human review.

import type { CategorySuggestion, Region, TxnDirection } from "./types";

export const REVIEW_THRESHOLD = 0.8;

interface Rule {
  test: RegExp;
  code: string;
  category: string;
  confidence: number;
  reason: string;
  zeroRated?: boolean; // VAT out of scope (salaries, bank charges)
}

const EXPENSE_RULES: Rule[] = [
  { test: /supplier|wholesale|stock|inventory|goods|trading|manufactur|import|distribut/i, code: "5000", category: "Cost of goods sold", confidence: 0.92, reason: "supplier / stock purchase keyword" },
  { test: /\brent\b|lease|landlord|tenancy|emaar|property mgmt/i, code: "6000", category: "Rent", confidence: 0.95, reason: "recurring rent payment" },
  { test: /salary|payroll|wages|\bwps\b|staff pay|employee/i, code: "6100", category: "Salaries & wages", confidence: 0.96, reason: "payroll run", zeroRated: true },
  { test: /aws|amazon web|google workspace|microsoft|azure|figma|adobe|slack|notion|github|saas|software|zoom|xero|quickbooks|subscription/i, code: "6200", category: "Software & subscriptions", confidence: 0.93, reason: "known SaaS vendor" },
  { test: /uber|careem|taxi|fuel|petrol|adnoc|enoc|emirates|airline|flight|trainline|\brail\b|parking|salik|\btoll\b/i, code: "6300", category: "Travel & transport", confidence: 0.9, reason: "travel / transport vendor" },
  { test: /facebook|\bmeta\b|google ads|tiktok|linkedin ads|advert|campaign|mailchimp|marketing/i, code: "6400", category: "Marketing & advertising", confidence: 0.9, reason: "ad platform / marketing" },
  { test: /bank fee|service charge|commission|merchant fee|stripe fee|paypal fee|\bfx\b|card fee/i, code: "6500", category: "Bank & merchant fees", confidence: 0.88, reason: "bank / processor fee", zeroRated: true },
  { test: /dewa|sewa|etisalat|\bdu\b|telecom|broadband|internet|electric|water bill|vodafone|\bbt\b|mobile/i, code: "6600", category: "Utilities & telecoms", confidence: 0.89, reason: "utility / telecom provider" },
  { test: /legal|lawyer|consult|accountant|audit|advisory|notary|solicitor/i, code: "6700", category: "Professional fees", confidence: 0.86, reason: "professional services" },
  { test: /office|stationery|supplies|ikea|furniture|\bprint\b|staples/i, code: "6800", category: "Office & supplies", confidence: 0.82, reason: "office supplies vendor" },
  { test: /restaurant|cafe|coffee|catering|deliveroo|talabat|zomato|costa|starbucks|lunch|dinner/i, code: "6900", category: "Meals & entertainment", confidence: 0.84, reason: "food / hospitality vendor" },
];

const INCOME_RULES: Rule[] = [
  { test: /consult|retainer|project fee|service agreement|professional services/i, code: "4100", category: "Services", confidence: 0.9, reason: "services invoice" },
  { test: /invoice|inv[-\s]?\d|payment from|sales|order|stripe payout|shopify|paypal|client|customer|remittance/i, code: "4000", category: "Sales", confidence: 0.92, reason: "customer sales receipt" },
];

const FALLBACK_EXPENSE: Rule = {
  test: /.*/,
  code: "6800",
  category: "Office & supplies",
  confidence: 0.58,
  reason: "no strong match — best guess, needs review",
};

const FALLBACK_INCOME: Rule = {
  test: /.*/,
  code: "4900",
  category: "Other income",
  confidence: 0.6,
  reason: "unclassified receipt — needs review",
};

export function categorize(
  description: string,
  counterparty: string,
  direction: TxnDirection,
  region: Region,
  standardVatRate: number,
): CategorySuggestion {
  const haystack = `${description} ${counterparty}`;
  const rules = direction === "in" ? INCOME_RULES : EXPENSE_RULES;
  const fallback = direction === "in" ? FALLBACK_INCOME : FALLBACK_EXPENSE;

  const hit = rules.find((r) => r.test.test(haystack)) ?? fallback;

  return {
    accountCode: hit.code,
    category: hit.category,
    vatRate: hit.zeroRated ? 0 : standardVatRate,
    confidence: hit.confidence,
    reason: hit.reason,
  };
}

/** Split a signed gross amount into signed net + signed VAT given a VAT rate. */
export function splitVat(gross: number, vatRate: number): { net: number; vat: number } {
  if (vatRate === 0) return { net: gross, vat: 0 };
  const net = gross / (1 + vatRate);
  return { net: round2(net), vat: round2(gross - net) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
