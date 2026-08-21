-- Mizan — Neon (Postgres) setup. Paste into the Neon SQL editor and Run once.
--
-- This is the post-Supabase schema: same tables and integrity rules, but
--   • NO row-level security (multi-tenant isolation is enforced in app code by
--     always filtering company_id — see lib/db/scope.ts),
--   • NO auth.users / storage.* (Clerk handles auth, R2 handles files),
--   • person ids are TEXT (Clerk user ids) instead of uuid.
-- The debit=credit balance trigger and the updated_at trigger are KEPT — they
-- are pure data-integrity and must live in the database.

-- ── people & tenancy ────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          text primary key,                       -- Clerk user id
  full_name   text,
  role        text not null default 'client' check (role in ('client','admin')),
  created_at  timestamptz not null default now()
);

create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  owner_id        text not null references public.profiles(id) on delete cascade,
  name            text not null,
  free_zone       text,
  license_no      text,
  trn             text,
  plan            text not null default 'starter' check (plan in ('starter','growth','pro')),
  status          text not null default 'onboarding' check (status in ('onboarding','active','paused')),
  region          text not null default 'ae' check (region in ('ae','gb')),
  vat_registered  boolean not null default true,
  invoice_counter int not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists public.company_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  user_id       text references public.profiles(id) on delete set null,
  invited_email text not null,
  role          text not null default 'tax_agent' check (role in ('owner','accountant','tax_agent','viewer')),
  status        text not null default 'pending' check (status in ('pending','active','revoked')),
  invited_by    text references public.profiles(id),
  created_at    timestamptz not null default now()
);
create unique index if not exists company_members_email_idx
  on public.company_members (company_id, invited_email);

-- ── documents & compliance ──────────────────────────────────────────────────
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  uploaded_by   text not null references public.profiles(id),
  storage_path  text not null,                         -- R2 object key
  original_name text not null,
  kind          text not null default 'other' check (kind in ('invoice','receipt','bank_statement','other')),
  status        text not null default 'new' check (status in ('new','reading','processed','failed')),
  created_at    timestamptz not null default now()
);

create table if not exists public.compliance_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  kind        text not null check (kind in ('vat_return','corporate_tax','bookkeeping','registration','other')),
  title       text not null,
  due_date    date,
  status      text not null default 'upcoming' check (status in ('upcoming','in_progress','filed','overdue')),
  filed_at    timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  sender_id   text not null references public.profiles(id),
  body        text not null,
  created_at  timestamptz not null default now()
);

-- ── bank import / rules engine ──────────────────────────────────────────────
create table if not exists public.statement_imports (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  uploaded_by   text not null references public.profiles(id),
  source_name   text not null,
  source_path   text,
  period_label  text,
  row_count     int not null default 0,
  posted_count  int not null default 0,
  review_count  int not null default 0,
  status        text not null default 'committed' check (status in ('parsed','committed')),
  created_at    timestamptz not null default now()
);

create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  import_id     uuid references public.statement_imports(id) on delete set null,
  txn_date      date not null,
  description   text not null,
  counterparty  text,
  amount        numeric(14,2) not null,
  direction     text not null check (direction in ('in','out')),
  account_code  text,
  category      text,
  vat_rate      numeric(5,4) not null default 0,
  vat_amount    numeric(14,2) not null default 0,
  net_amount    numeric(14,2) not null default 0,
  status        text not null default 'review' check (status in ('posted','review','uncategorized')),
  confidence    numeric(4,3),
  source        text not null default 'manual' check (source in ('rule','ai','manual','import','seed')),
  reason        text,
  created_by    text references public.profiles(id),
  created_at    timestamptz not null default now(),
  posted_at     timestamptz
);
create index if not exists transactions_company_date_idx on public.transactions (company_id, txn_date);
create index if not exists transactions_company_status_idx on public.transactions (company_id, status);

create table if not exists public.vendor_rules (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  match_text   text not null,
  account_code text not null,
  category     text not null,
  vat_rate     numeric(5,4) not null default 0,
  direction    text check (direction in ('in','out')),
  hits         int not null default 0,
  created_by   text references public.profiles(id),
  created_at   timestamptz not null default now()
);
create unique index if not exists vendor_rules_match_idx on public.vendor_rules (company_id, match_text);

create table if not exists public.tax_packs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  period_label    text not null,
  period_start    date,
  period_end      date,
  storage_path    text,
  recipient_email text,
  totals          jsonb,
  status          text not null default 'draft' check (status in ('draft','shared','sent')),
  created_by      text references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- ── AI ledger + double-entry engine ─────────────────────────────────────────
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
  reviewed_by   text references public.profiles(id),
  reversal_of   uuid references public.ledger_entries(id) on delete set null,
  reversed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ledger_company_idx on public.ledger_entries (company_id, entry_date);
create index if not exists ledger_document_idx on public.ledger_entries (document_id);
create index if not exists ledger_reversal_of_idx on public.ledger_entries (reversal_of);

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

create table if not exists public.journal_entries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  ledger_entry_id uuid unique references public.ledger_entries(id) on delete cascade,
  entry_date      date not null,
  memo            text not null default '',
  source          text not null default 'ledger' check (source in ('ledger','manual','adjustment')),
  created_at      timestamptz not null default now()
);
create index if not exists journal_entries_company_idx on public.journal_entries (company_id, entry_date);

create table if not exists public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.journal_entries(id) on delete cascade,
  account_id  uuid not null references public.accounts(id),
  debit       numeric(14,2) not null default 0 check (debit >= 0),
  credit      numeric(14,2) not null default 0 check (credit >= 0),
  constraint one_sided check (not (debit > 0 and credit > 0))
);
create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines (account_id);

-- Balance enforcement: sum(debit) = sum(credit) per entry, checked at COMMIT.
create or replace function public.assert_journal_balanced()
returns trigger language plpgsql as $$
declare
  eid uuid := coalesce(new.entry_id, old.entry_id);
  d numeric(14,2);
  c numeric(14,2);
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c
    from public.journal_lines where entry_id = eid;
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

-- ── customers & invoicing ───────────────────────────────────────────────────
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  trn         text,
  address     text,
  notes       text,
  archived    boolean not null default false,
  created_by  text references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists customers_company_name_idx on public.customers (company_id, name);

-- Atomic per-company invoice number. Authorization is enforced in app code
-- before this is called (the caller already proved it owns the company).
create or replace function public.next_invoice_seq(cid uuid)
returns int language sql as $$
  update public.companies set invoice_counter = invoice_counter + 1
  where id = cid returning invoice_counter;
$$;

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete restrict,
  number          text not null,
  seq             int not null,
  issue_date      date not null default current_date,
  due_date        date,
  currency        text not null default 'AED',
  status          text not null default 'draft' check (status in ('draft','sent','paid','void')),
  subtotal        numeric(14,2) not null default 0,
  vat_amount      numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  notes           text,
  share_token     text unique,
  sent_at         timestamptz,
  paid_at         timestamptz,
  ledger_entry_id uuid references public.ledger_entries(id) on delete set null,
  payment_link    text,
  place_of_supply text,
  einvoice        jsonb,
  created_by      text references public.profiles(id),
  created_at      timestamptz not null default now()
);
create unique index if not exists invoices_company_number_idx on public.invoices (company_id, number);
create index if not exists invoices_company_status_idx on public.invoices (company_id, status);
create index if not exists invoices_company_issue_idx on public.invoices (company_id, issue_date);

create table if not exists public.invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  position    int not null default 0,
  description text not null,
  qty         numeric(12,3) not null default 1,
  unit_price  numeric(14,2) not null default 0,
  vat_rate    numeric(5,4) not null default 0,
  line_net    numeric(14,2) not null default 0,
  line_vat    numeric(14,2) not null default 0,
  line_total  numeric(14,2) not null default 0
);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id, position);

-- ── waitlist (marketing) ────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null,
  company     text,
  stage       text,
  created_at  timestamptz not null default now()
);
create unique index if not exists waitlist_email_idx on public.waitlist (lower(email));

-- ── admin bootstrap ─────────────────────────────────────────────────────────
-- After you sign in once with Clerk (which creates your profiles row), run:
--   update public.profiles set role='admin' where id = 'YOUR_CLERK_USER_ID';
