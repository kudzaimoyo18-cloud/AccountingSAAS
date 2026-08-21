-- Mizan schema v10: reversing entries (audit-safe corrections)
--
-- Accounting never erases a posted line. To "clear a mistake" on an APPROVED
-- ledger entry we post a mirror entry (opposite direction, same amounts) that
-- nets the original to zero, and keep BOTH in the books for the audit trail.
--
--   reversal_of  -> set on the NEW mirror line, points at the original entry
--   reversed_at  -> set on the ORIGINAL entry when it has been reversed
--
-- This also lets a prior-period error be corrected without touching a closed
-- period: the reversal simply lands in the current open period.
--
-- Run after 0009_customers_invoices.sql. Idempotent — safe to re-run.

alter table public.ledger_entries
  add column if not exists reversal_of uuid
    references public.ledger_entries(id) on delete set null,
  add column if not exists reversed_at timestamptz;

create index if not exists ledger_reversal_of_idx
  on public.ledger_entries (reversal_of);
