// Chart of accounts per region. Codes follow a simple 4-digit convention:
// 4xxx income · 5xxx-6xxx expenses · 1xxx assets · 2xxx liabilities · 3xxx equity.

import type { Account, Region } from "./types";

const SHARED_EXPENSES: Account[] = [
  { code: "5000", name: "Cost of goods sold", type: "expense" },
  { code: "6000", name: "Rent", type: "expense" },
  { code: "6100", name: "Salaries & wages", type: "expense" },
  { code: "6200", name: "Software & subscriptions", type: "expense" },
  { code: "6300", name: "Travel & transport", type: "expense" },
  { code: "6400", name: "Marketing & advertising", type: "expense" },
  { code: "6500", name: "Bank & merchant fees", type: "expense" },
  { code: "6600", name: "Utilities & telecoms", type: "expense" },
  { code: "6700", name: "Professional fees", type: "expense" },
  { code: "6800", name: "Office & supplies", type: "expense" },
  { code: "6900", name: "Meals & entertainment", type: "expense" },
];

const INCOME: Account[] = [
  { code: "4000", name: "Sales", type: "income" },
  { code: "4100", name: "Services", type: "income" },
  { code: "4900", name: "Other income", type: "income" },
];

const STRUCTURAL: Account[] = [
  { code: "1000", name: "Bank", type: "asset" },
  { code: "1100", name: "Accounts receivable", type: "asset" },
  { code: "2000", name: "Accounts payable", type: "liability" },
  { code: "2200", name: "VAT control", type: "liability" },
  { code: "3000", name: "Owner's equity", type: "equity" },
];

const ACCOUNTS: Record<Region, Account[]> = {
  ae: [...INCOME, ...SHARED_EXPENSES, ...STRUCTURAL],
  gb: [...INCOME, ...SHARED_EXPENSES, ...STRUCTURAL],
};

export function accountsFor(region: Region): Account[] {
  return ACCOUNTS[region];
}

export function accountByCode(region: Region, code: string): Account | undefined {
  return ACCOUNTS[region].find((a) => a.code === code);
}

// Accounts an end user is allowed to re-assign a transaction to in the review queue.
export function selectableAccounts(region: Region): Account[] {
  return ACCOUNTS[region].filter(
    (a) => a.type === "income" || a.type === "expense",
  );
}
