-- Mizan — self-serve double-entry accounting: one-shot setup.
-- Paste the WHOLE thing into the Supabase SQL editor (project qdimyblhdvszoedwieyv)
-- and click Run. Safe to run even if parts already exist, and safe to re-run.
-- Prereqs (already present): public.companies, documents, profiles,
-- public.owns_company(uuid), public.is_admin().

-- ledger_entries ------------------------------------------------------------
create table if not exists public.ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  document_id   uuid references public.documents(id) on delete set null,
  entry_date    date,
  description   text not null default '',
  counterparty  text,
  category      text not null default 'uncategorised',
  direction     text not null default 'expense' check (direction in ('income','expense')),
  currency      text not null default 'AED',
  amount        numeric(14,2) not null default 0,
  vat_amount    numeric(14,2) not null default 0,
  confidence    numeric(4,3),
  source        text not null default 'ai' check (source in ('ai','manual')),
  status        text not null default 'draft' check (status in ('draft','reviewed','approved')),
  notes         text,
  reviewed_by   uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ledger_company_idx on public.ledger_entries (company_id, entry_date);
create index if not exists ledger_document_idx on public.ledger_entries (document_id);
alter table public.ledger_entries enable row level security;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists ledger_touch on public.ledger_entries;
create trigger ledger_touch before update on public.ledger_entries
  for each row execute function public.touch_updated_at();

-- accounts ------------------------------------------------------------------
create table if not exists public.accounts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  code          text not null,
  name          text not null,
  type          text not null check (type in ('asset','liability','equity','income','expense')),
  vat_treatment text not null default 'none' check (vat_treatment in ('none','input','output')),
  created_at    timestamptz not null default now(),
  unique (company_id, code)
);
create index if not exists accounts_company_idx on public.accounts (company_id, code);
alter table public.accounts enable row level security;

-- journal_entries + journal_lines (double-entry) ----------------------------
create table if not exists public.journal_entries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  ledger_entry_id uuid unique references public.ledger_entries(id) on delete cascade,
  entry_date      date not null,
  memo            text not null default '',
  source          text not null default 'ledger' check (source in ('ledger','manual','adjustment')),
  created_at      timestamptz not null default now()
);
create table if not exists public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.journal_entries(id) on delete cascade,
  account_id  uuid not null references public.accounts(id),
  debit       numeric(14,2) not null default 0 check (debit >= 0),
  credit      numeric(14,2) not null default 0 check (credit >= 0),
  constraint one_sided check (not (debit > 0 and credit > 0))
);
create index if not exists journal_entries_company_idx on public.journal_entries (company_id, entry_date);
create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines (account_id);
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create or replace function public.journal_line_company(eid uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select company_id from public.journal_entries where id = eid;
$$;

create or replace function public.assert_journal_balanced()
returns trigger language plpgsql as $$
declare
  eid uuid := coalesce(new.entry_id, old.entry_id);
  d numeric(14,2);
  c numeric(14,2);
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into d, c from public.journal_lines where entry_id = eid;
  if d is null then return null; end if;
  if d <> c then
    raise exception 'journal entry % is unbalanced: debit % <> credit %', eid, d, c;
  end if;
  return null;
end;
$$;
drop trigger if exists journal_balanced on public.journal_lines;
create constraint trigger journal_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.assert_journal_balanced();

-- bank_transactions ---------------------------------------------------------
create table if not exists public.bank_transactions (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  txn_date         date not null,
  description      text not null default '',
  amount           numeric(14,2) not null,
  currency         text not null default 'AED',
  matched_entry_id uuid references public.journal_entries(id) on delete set null,
  status           text not null default 'unmatched' check (status in ('unmatched','matched','ignored')),
  created_at       timestamptz not null default now()
);
create index if not exists bank_txn_company_idx on public.bank_transactions (company_id, txn_date);
create index if not exists bank_txn_status_idx on public.bank_transactions (company_id, status);
alter table public.bank_transactions enable row level security;

-- accounting_periods --------------------------------------------------------
create table if not exists public.accounting_periods (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  label          text not null,
  start_date     date not null,
  end_date       date not null,
  status         text not null default 'open' check (status in ('open','closed')),
  vat_output     numeric(14,2) not null default 0,
  vat_input      numeric(14,2) not null default 0,
  vat_net        numeric(14,2) not null default 0,
  taxable_profit numeric(14,2) not null default 0,
  corporate_tax  numeric(14,2) not null default 0,
  closed_at      timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists periods_company_idx on public.accounting_periods (company_id, end_date);
alter table public.accounting_periods enable row level security;

-- RLS: owner (or admin) can read AND write their own books ------------------
drop policy if exists "ledger select" on public.ledger_entries;
drop policy if exists "ledger insert admin" on public.ledger_entries;
drop policy if exists "ledger update admin" on public.ledger_entries;
drop policy if exists "ledger delete admin" on public.ledger_entries;
drop policy if exists "ledger insert own" on public.ledger_entries;
drop policy if exists "ledger update own" on public.ledger_entries;
drop policy if exists "ledger delete own" on public.ledger_entries;
create policy "ledger select" on public.ledger_entries
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "ledger insert own" on public.ledger_entries
  for insert with check (public.owns_company(company_id) or public.is_admin());
create policy "ledger update own" on public.ledger_entries
  for update using (public.owns_company(company_id) or public.is_admin());
create policy "ledger delete own" on public.ledger_entries
  for delete using (public.owns_company(company_id) or public.is_admin());

drop policy if exists "accounts select" on public.accounts;
drop policy if exists "accounts insert admin" on public.accounts;
drop policy if exists "accounts update admin" on public.accounts;
drop policy if exists "accounts delete admin" on public.accounts;
drop policy if exists "accounts insert own" on public.accounts;
drop policy if exists "accounts update own" on public.accounts;
drop policy if exists "accounts delete own" on public.accounts;
create policy "accounts select" on public.accounts
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "accounts insert own" on public.accounts
  for insert with check (public.owns_company(company_id) or public.is_admin());
create policy "accounts update own" on public.accounts
  for update using (public.owns_company(company_id) or public.is_admin());
create policy "accounts delete own" on public.accounts
  for delete using (public.owns_company(company_id) or public.is_admin());

drop policy if exists "journal_entries select" on public.journal_entries;
drop policy if exists "journal_entries write admin" on public.journal_entries;
drop policy if exists "journal_entries write own" on public.journal_entries;
create policy "journal_entries select" on public.journal_entries
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "journal_entries write own" on public.journal_entries
  for all using (public.owns_company(company_id) or public.is_admin())
  with check (public.owns_company(company_id) or public.is_admin());

drop policy if exists "journal_lines select" on public.journal_lines;
drop policy if exists "journal_lines write admin" on public.journal_lines;
drop policy if exists "journal_lines write own" on public.journal_lines;
create policy "journal_lines select" on public.journal_lines
  for select using (public.owns_company(public.journal_line_company(entry_id)) or public.is_admin());
create policy "journal_lines write own" on public.journal_lines
  for all using (public.owns_company(public.journal_line_company(entry_id)) or public.is_admin())
  with check (public.owns_company(public.journal_line_company(entry_id)) or public.is_admin());

drop policy if exists "bank select" on public.bank_transactions;
drop policy if exists "bank write admin" on public.bank_transactions;
drop policy if exists "bank write own" on public.bank_transactions;
create policy "bank select" on public.bank_transactions
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "bank write own" on public.bank_transactions
  for all using (public.owns_company(company_id) or public.is_admin())
  with check (public.owns_company(company_id) or public.is_admin());

drop policy if exists "periods select" on public.accounting_periods;
drop policy if exists "periods write admin" on public.accounting_periods;
drop policy if exists "periods write own" on public.accounting_periods;
create policy "periods select" on public.accounting_periods
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "periods write own" on public.accounting_periods
  for all using (public.owns_company(company_id) or public.is_admin())
  with check (public.owns_company(company_id) or public.is_admin());
