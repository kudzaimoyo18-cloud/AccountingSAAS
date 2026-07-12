-- Mizan schema v9: customers + invoicing.
--
-- QuickBooks-style customer records and invoices with share links. An invoice
-- marked paid posts an approved ledger_entries row (income, sales_revenue) and
-- the journal engine (lib/books/posting.ts) makes the double entry, so paid
-- invoices flow into /app/reports like any other approved line.
--
-- Run after 0008_self_serve_accounting.sql. Idempotent — safe to re-run.

-- ============ CUSTOMERS (the people/businesses you invoice) ============
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  trn         text,               -- customer VAT/TRN (needed for FTA e-invoicing later)
  address     text,
  notes       text,
  archived    boolean not null default false,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists customers_company_name_idx
  on public.customers (company_id, name);
alter table public.customers enable row level security;

drop policy if exists "customers select" on public.customers;
create policy "customers select" on public.customers
  for select using (public.can_access_company(company_id));
drop policy if exists "customers insert" on public.customers;
create policy "customers insert" on public.customers
  for insert with check (public.owns_company(company_id) or public.is_admin());
drop policy if exists "customers update" on public.customers;
create policy "customers update" on public.customers
  for update using (public.owns_company(company_id) or public.is_admin());
drop policy if exists "customers delete" on public.customers;
create policy "customers delete" on public.customers
  for delete using (public.owns_company(company_id) or public.is_admin());

-- ============ INVOICE NUMBERING (atomic per-company counter) ============
alter table public.companies
  add column if not exists invoice_counter int not null default 0;

-- Atomic increment; returns null when the caller can't write this company.
create or replace function public.next_invoice_seq(cid uuid)
returns int
language sql security definer set search_path = public
as $$
  update public.companies
  set invoice_counter = invoice_counter + 1
  where id = cid and (public.owns_company(cid) or public.is_admin())
  returning invoice_counter;
$$;

-- ============ INVOICES ============
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete restrict,
  number          text not null,                     -- e.g. INV-0007
  seq             int not null,
  issue_date      date not null default current_date,
  due_date        date,
  currency        text not null default 'AED',       -- ae → AED, gb → GBP
  status          text not null default 'draft'
    check (status in ('draft','sent','paid','void')),
  subtotal        numeric(14,2) not null default 0,  -- net of VAT
  vat_amount      numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,  -- gross
  notes           text,
  share_token     text unique,                       -- unguessable public-link token
  sent_at         timestamptz,
  paid_at         timestamptz,
  ledger_entry_id uuid references public.ledger_entries(id) on delete set null,
  -- Future-proofing (columns only, no logic yet):
  payment_link    text,                              -- per-invoice pay link (Ziina/Stripe later)
  place_of_supply text,                              -- FTA e-invoicing
  einvoice        jsonb,                             -- ASP/Peppol metadata later
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);
create unique index if not exists invoices_company_number_idx
  on public.invoices (company_id, number);
create index if not exists invoices_company_status_idx
  on public.invoices (company_id, status);
create index if not exists invoices_company_issue_idx
  on public.invoices (company_id, issue_date);
alter table public.invoices enable row level security;

drop policy if exists "invoices select" on public.invoices;
create policy "invoices select" on public.invoices
  for select using (public.can_access_company(company_id));
drop policy if exists "invoices insert" on public.invoices;
create policy "invoices insert" on public.invoices
  for insert with check (public.owns_company(company_id) or public.is_admin());
drop policy if exists "invoices update" on public.invoices;
create policy "invoices update" on public.invoices
  for update using (public.owns_company(company_id) or public.is_admin());
drop policy if exists "invoices delete" on public.invoices;
create policy "invoices delete" on public.invoices
  for delete using (public.owns_company(company_id) or public.is_admin());

-- ============ INVOICE LINES ============
create table if not exists public.invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  position    int not null default 0,
  description text not null,
  qty         numeric(12,3) not null default 1,
  unit_price  numeric(14,2) not null default 0,      -- net of VAT
  vat_rate    numeric(5,4) not null default 0,       -- 0.05, 0.20, 0
  line_net    numeric(14,2) not null default 0,
  line_vat    numeric(14,2) not null default 0,
  line_total  numeric(14,2) not null default 0
);
create index if not exists invoice_lines_invoice_idx
  on public.invoice_lines (invoice_id, position);
alter table public.invoice_lines enable row level security;

drop policy if exists "invoice lines select" on public.invoice_lines;
create policy "invoice lines select" on public.invoice_lines
  for select using (public.can_access_company(company_id));
drop policy if exists "invoice lines insert" on public.invoice_lines;
create policy "invoice lines insert" on public.invoice_lines
  for insert with check (public.owns_company(company_id) or public.is_admin());
drop policy if exists "invoice lines update" on public.invoice_lines;
create policy "invoice lines update" on public.invoice_lines
  for update using (public.owns_company(company_id) or public.is_admin());
drop policy if exists "invoice lines delete" on public.invoice_lines;
create policy "invoice lines delete" on public.invoice_lines
  for delete using (public.owns_company(company_id) or public.is_admin());
