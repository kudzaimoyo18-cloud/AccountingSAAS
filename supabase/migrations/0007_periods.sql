-- Mizan schema v6: accounting periods (close + tax snapshot).
-- Run after 0005_bank.sql. Closing a period snapshots the VAT and corporate-tax
-- figures computed from the posted journals for that date range.

create table if not exists public.accounting_periods (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  label           text not null,                 -- e.g. "Q2 2026"
  start_date      date not null,
  end_date        date not null,
  status          text not null default 'open' check (status in ('open','closed')),
  vat_output      numeric(14,2) not null default 0,
  vat_input       numeric(14,2) not null default 0,
  vat_net         numeric(14,2) not null default 0,   -- payable to FTA (output - input)
  taxable_profit  numeric(14,2) not null default 0,
  corporate_tax   numeric(14,2) not null default 0,   -- 9% over the AED 375k threshold
  closed_at       timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists periods_company_idx on public.accounting_periods (company_id, end_date);

alter table public.accounting_periods enable row level security;

create policy "periods select" on public.accounting_periods
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "periods write admin" on public.accounting_periods
  for all using (public.is_admin()) with check (public.is_admin());
