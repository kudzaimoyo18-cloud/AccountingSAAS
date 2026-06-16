// Core domain types for the Mizan bookkeeping demo ("Studio").
// Region-agnostic; region specifics live in regions.ts and coa.ts.

export type Region = "ae" | "gb";

export type AccountType = "income" | "expense" | "asset" | "liability" | "equity";

export interface Account {
  code: string;
  name: string;
  type: AccountType;
}

export type TxnStatus = "posted" | "review" | "uncategorized";
export type TxnDirection = "in" | "out";
export type TxnSource = "seed" | "import";

/**
 * A single bank-feed line. `amount` is gross and signed:
 * positive = money in (sale), negative = money out (expense).
 * net + vatAmount are derived from amount + vatRate at categorisation time.
 */
export interface Transaction {
  id: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  counterparty: string;
  amount: number; // signed gross
  direction: TxnDirection;
  accountCode: string | null;
  category: string | null; // display name of the account
  vatRate: number; // 0, 0.05, 0.2 ...
  vatAmount: number; // signed, same sign as amount
  net: number; // signed gross - vat
  status: TxnStatus;
  confidence: number | null; // 0..1 from the categoriser
  source: TxnSource;
  reason?: string; // why the categoriser picked this account
}

/** Result of running the categoriser over one raw bank line. */
export interface CategorySuggestion {
  accountCode: string;
  category: string;
  vatRate: number;
  confidence: number; // 0..1
  reason: string;
}
