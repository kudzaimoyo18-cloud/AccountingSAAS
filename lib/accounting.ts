// Double-entry accounting core. Pure logic only (no DB) so it is easy to reason
// about and test. The DB plumbing lives in lib/accounting-actions.ts.

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type VatTreatment = "none" | "input" | "output";

export type AccountDef = {
  code: string;
  name: string;
  type: AccountType;
  vat_treatment: VatTreatment;
};

// Default UAE free-zone chart of accounts. Seeded per company; reviewers can
// extend it. Codes follow the usual 1000=asset … 5000=expense convention.
export const DEFAULT_CHART: AccountDef[] = [
  // Assets
  { code: "1000", name: "Bank", type: "asset", vat_treatment: "none" },
  { code: "1100", name: "Accounts Receivable", type: "asset", vat_treatment: "none" },
  { code: "1200", name: "VAT Input (recoverable)", type: "asset", vat_treatment: "input" },
  { code: "1500", name: "Fixed Assets — Equipment", type: "asset", vat_treatment: "none" },
  // Liabilities
  { code: "2000", name: "Accounts Payable", type: "liability", vat_treatment: "none" },
  { code: "2100", name: "VAT Output (payable)", type: "liability", vat_treatment: "output" },
  { code: "2200", name: "Corporate Tax Payable", type: "liability", vat_treatment: "none" },
  // Equity
  { code: "3000", name: "Share Capital", type: "equity", vat_treatment: "none" },
  { code: "3100", name: "Retained Earnings", type: "equity", vat_treatment: "none" },
  // Income
  { code: "4000", name: "Sales Revenue", type: "income", vat_treatment: "none" },
  { code: "4100", name: "Other Income", type: "income", vat_treatment: "none" },
  // Expenses
  { code: "5000", name: "Cost of Sales", type: "expense", vat_treatment: "none" },
  { code: "5100", name: "Salaries & Wages", type: "expense", vat_treatment: "none" },
  { code: "5200", name: "Rent", type: "expense", vat_treatment: "none" },
  { code: "5300", name: "Utilities", type: "expense", vat_treatment: "none" },
  { code: "5400", name: "Software Subscriptions", type: "expense", vat_treatment: "none" },
  { code: "5500", name: "Professional Fees", type: "expense", vat_treatment: "none" },
  { code: "5600", name: "Marketing", type: "expense", vat_treatment: "none" },
  { code: "5700", name: "Travel", type: "expense", vat_treatment: "none" },
  { code: "5800", name: "Bank Charges", type: "expense", vat_treatment: "none" },
  { code: "5900", name: "Government Fees", type: "expense", vat_treatment: "none" },
  { code: "6000", name: "Office Supplies", type: "expense", vat_treatment: "none" },
  { code: "6100", name: "Uncategorised Expense", type: "expense", vat_treatment: "none" },
];

// Key accounts used by the posting rules.
export const ACC = {
  bank: "1000",
  receivable: "1100",
  vatInput: "1200",
  payable: "2000",
  vatOutput: "2100",
  retainedEarnings: "3100",
  otherIncome: "4100",
  uncategorisedExpense: "6100",
} as const;

// Maps a ledger category (lib/ai.ts) to a chart-of-accounts code.
const CATEGORY_TO_CODE: Record<string, string> = {
  sales_revenue: "4000",
  other_income: "4100",
  cost_of_sales: "5000",
  salaries_wages: "5100",
  rent: "5200",
  utilities: "5300",
  software_subscriptions: "5400",
  professional_fees: "5500",
  marketing: "5600",
  travel: "5700",
  bank_charges: "5800",
  government_fees: "5900",
  office_supplies: "6000",
  equipment: "1500", // capitalised as a fixed asset, not expensed
  uncategorised: "6100",
};

export function accountCodeFor(
  category: string,
  direction: "income" | "expense",
): string {
  const mapped = CATEGORY_TO_CODE[category];
  if (mapped) return mapped;
  return direction === "income" ? ACC.otherIncome : ACC.uncategorisedExpense;
}

export type PostingLine = { code: string; debit: number; credit: number };

// Turns one (approved) ledger entry into a balanced set of journal lines.
// Cash basis: the counter-account is Bank — income/expense hits the books when
// the money moves, matching what a self-serve owner sees in their bank account.
//   Expense: Dr expense (net) + Dr VAT Input (vat)  →  Cr Bank (gross)
//   Income:  Dr Bank (gross)  →  Cr income (net) + Cr VAT Output (vat)
export function postingLinesFor(entry: {
  direction: "income" | "expense";
  category: string;
  amount: number; // net
  vat_amount: number;
}): PostingLine[] {
  const net = round2(entry.amount);
  const vat = round2(entry.vat_amount);
  const gross = round2(net + vat);
  const acct = accountCodeFor(entry.category, entry.direction);

  if (entry.direction === "expense") {
    const lines: PostingLine[] = [{ code: acct, debit: net, credit: 0 }];
    if (vat > 0) lines.push({ code: ACC.vatInput, debit: vat, credit: 0 });
    lines.push({ code: ACC.bank, debit: 0, credit: gross });
    return lines;
  }

  // income
  const lines: PostingLine[] = [{ code: ACC.bank, debit: gross, credit: 0 }];
  lines.push({ code: acct, debit: 0, credit: net });
  if (vat > 0) lines.push({ code: ACC.vatOutput, debit: 0, credit: vat });
  return lines;
}

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// --- Statement aggregation -------------------------------------------------
// Input is a flat list of posted lines joined with their account.

export type PostedLine = {
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
};

export type TrialRow = {
  code: string;
  name: string;
  type: AccountType;
  debit: number; // total debits
  credit: number; // total credits
  balance: number; // debit - credit (natural sign)
};

export function trialBalance(lines: PostedLine[]): {
  rows: TrialRow[];
  totalDebit: number;
  totalCredit: number;
} {
  const by = new Map<string, TrialRow>();
  for (const l of lines) {
    const r =
      by.get(l.code) ??
      { code: l.code, name: l.name, type: l.type, debit: 0, credit: 0, balance: 0 };
    r.debit = round2(r.debit + Number(l.debit));
    r.credit = round2(r.credit + Number(l.credit));
    r.balance = round2(r.debit - r.credit);
    by.set(l.code, r);
  }
  const rows = [...by.values()].sort((a, b) => a.code.localeCompare(b.code));
  return {
    rows,
    totalDebit: round2(rows.reduce((t, r) => t + r.debit, 0)),
    totalCredit: round2(rows.reduce((t, r) => t + r.credit, 0)),
  };
}

export type StatementLine = { code: string; name: string; amount: number };

export function profitAndLoss(lines: PostedLine[]) {
  const tb = trialBalance(lines).rows;
  // income carries a credit balance; expense a debit balance
  const income: StatementLine[] = tb
    .filter((r) => r.type === "income")
    .map((r) => ({ code: r.code, name: r.name, amount: round2(-r.balance) }));
  const expense: StatementLine[] = tb
    .filter((r) => r.type === "expense")
    .map((r) => ({ code: r.code, name: r.name, amount: round2(r.balance) }));
  const totalIncome = round2(income.reduce((t, r) => t + r.amount, 0));
  const totalExpense = round2(expense.reduce((t, r) => t + r.amount, 0));
  return { income, expense, totalIncome, totalExpense, netProfit: round2(totalIncome - totalExpense) };
}

export function balanceSheet(lines: PostedLine[]) {
  const tb = trialBalance(lines).rows;
  const assets: StatementLine[] = tb
    .filter((r) => r.type === "asset")
    .map((r) => ({ code: r.code, name: r.name, amount: round2(r.balance) }));
  const liabilities: StatementLine[] = tb
    .filter((r) => r.type === "liability")
    .map((r) => ({ code: r.code, name: r.name, amount: round2(-r.balance) }));
  const equity: StatementLine[] = tb
    .filter((r) => r.type === "equity")
    .map((r) => ({ code: r.code, name: r.name, amount: round2(-r.balance) }));

  const { netProfit } = profitAndLoss(lines);
  // current-period profit accrues to equity (retained earnings)
  equity.push({ code: ACC.retainedEarnings + "*", name: "Current period profit", amount: netProfit });

  const totalAssets = round2(assets.reduce((t, r) => t + r.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((t, r) => t + r.amount, 0));
  const totalEquity = round2(equity.reduce((t, r) => t + r.amount, 0));
  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: round2(totalAssets - (totalLiabilities + totalEquity)) === 0,
  };
}
