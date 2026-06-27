# Mizan — Bookkeeping → Full Accounting Roadmap

Mizan started as **bookkeeping**: AI drafts ledger lines from uploaded documents
(`ledger_entries`), a licensed reviewer edits and approves them. This roadmap
extends that into **full accounting** — double-entry, financial statements,
reconciliation, and tax computation — while keeping the same compliance ethos:

> **AI drafts → licensed FTA tax agent reviews → approved.** The engine produces
> drafts; a human signs off before anything is filed.

## Bookkeeping vs. accounting

- **Bookkeeping** = *capturing* transactions (date, counterparty, amount, VAT).
- **Accounting** = *turning records into statements and filings* — double-entry,
  trial balance, P&L, balance sheet, cash flow, period close, VAT / corporate-tax.

The original `ledger_entries` table is single-entry. Real accounting needs a
**double-entry** core so the output is balance-sheet-correct and audit-defensible.

## Architecture

```
documents ──AI──▶ ledger_entries (draft → reviewed → approved)   [bookkeeping]
                          │  on approval, post to:
                          ▼
                  journal_entries / journal_lines (Dr = Cr)        [double-entry]
                          │  aggregated into:
                          ▼
            Trial Balance → P&L → Balance Sheet → Cash Flow        [statements]
                          │  per locked period:
                          ▼
                  VAT return + Corporate-tax computation           [tax]
                          │  feeds:
                          ▼
                  compliance_items (existing deadlines)            [filing]
```

## Phases

### Phase 1 — Chart of Accounts ✅ (this commit)
- `accounts` table: `code`, `name`, `type` (asset/liability/equity/income/expense),
  `vat_treatment`. Seeded with a UAE free-zone default chart per company.
- Canonical CoA + `category → account` mapping in `lib/accounting.ts`.

### Phase 2 — Double-entry journal engine ✅ (this commit)
- `journal_entries` (header) + `journal_lines` (account, debit, credit).
- DB trigger enforces **debits = credits** per entry (deferred, checked at commit).
- Posting service: each **approved** `ledger_entry` becomes one balanced journal
  entry. Standard accrual rules:
  - Expense: `Dr expense  Dr VAT-input  Cr Accounts Payable`
  - Income:  `Dr Accounts Receivable  Cr income  Cr VAT-output`
  - Idempotent: one journal entry per ledger entry (`ledger_entry_id` unique).

### Phase 3 — Financial statements ✅ (this commit)
- **Trial Balance** (debits/credits per account), **P&L** (income − expense),
  **Balance Sheet** (assets = liabilities + equity, with net profit → retained
  earnings). Pure aggregation over journal lines. Rendered at
  `/admin/[id]/reports`.

### Phase 4 — Bank import & reconciliation (next)
- `bank_transactions` (CSV / statement import) + reconciliation matches.
- AI matches bank lines to journal entries; flags unreconciled items.
- Delivers the Pro-tier "audit-ready records" promise.

### Phase 5 — Period close & tax computation (next)
- `accounting_periods` (lockable) + adjusting entries (accruals, depreciation,
  prepayments).
- **VAT return**: output − input VAT per period (from `2100`/`1200` accounts).
- **Corporate tax**: 9% on taxable profit above AED 375,000, with free-zone
  qualifying-income handling.
- Closing a period generates a filing draft into `compliance_items` for the
  licensed agent to review.

## Status
- Phases 1–3: implemented (this commit).
- Phases 4–5: planned. See migrations `0003_accounts.sql`, `0004_journals.sql`.
