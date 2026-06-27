-- Mizan schema v3: Chart of Accounts (foundation for double-entry accounting).
-- Run after 0002_ledger.sql. Each company gets its own copy of the chart so it
-- can be customised. The default UAE free-zone chart is seeded from the app
-- (lib/accounting.ts) the first time accounts are needed.

create table if not exists public.accounts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  code          text not null,                 -- e.g. "5300"
  name          text not null,                 -- e.g. "Utilities"
  type          text not null check (type in ('asset','liability','equity','income','expense')),
  vat_treatment text not null default 'none' check (vat_treatment in ('none','input','output')),
  created_at    timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists accounts_company_idx on public.accounts (company_id, code);

alter table public.accounts enable row level security;

create policy "accounts select" on public.accounts
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "accounts insert admin" on public.accounts
  for insert with check (public.is_admin());
create policy "accounts update admin" on public.accounts
  for update using (public.is_admin());
create policy "accounts delete admin" on public.accounts
  for delete using (public.is_admin());
