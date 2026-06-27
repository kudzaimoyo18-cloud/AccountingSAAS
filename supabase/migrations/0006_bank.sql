-- Mizan schema v5: bank import + reconciliation.
-- Run after 0004_journals.sql. Imported bank lines are matched to journal
-- entries so the recorded books agree with what actually moved through the bank.

create table if not exists public.bank_transactions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  txn_date        date not null,
  description     text not null default '',
  amount          numeric(14,2) not null,        -- signed: money in > 0, out < 0
  currency        text not null default 'AED',
  matched_entry_id uuid references public.journal_entries(id) on delete set null,
  status          text not null default 'unmatched' check (status in ('unmatched','matched','ignored')),
  created_at      timestamptz not null default now()
);

create index if not exists bank_txn_company_idx on public.bank_transactions (company_id, txn_date);
create index if not exists bank_txn_status_idx on public.bank_transactions (company_id, status);

alter table public.bank_transactions enable row level security;

create policy "bank select" on public.bank_transactions
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "bank write admin" on public.bank_transactions
  for all using (public.is_admin()) with check (public.is_admin());
