-- Mizan — COMPLETE database setup for a fresh Supabase project.
-- Paste this WHOLE file into the new project's SQL editor and click Run.
-- Recreates every table, RLS policy, function, the storage bucket, and the
-- reversing-entries columns. Run once on an empty project.


-- ============================================================
-- 0001_init.sql
-- ============================================================

-- Mizan schema v1: waitlist + portal (profiles, companies, documents, compliance, messages)
-- Paste this whole file into Supabase SQL Editor and run once.

-- ============ WAITLIST ============
create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null,
  company     text,
  stage       text,
  created_at  timestamptz not null default now()
);
create unique index if not exists waitlist_email_idx on public.waitlist (lower(email));
alter table public.waitlist enable row level security;
-- inserts come from the server with service role only; no public policies needed.

-- ============ PROFILES ============
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'client' check (role in ('client','admin')),
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- admin check helper (security definer dodges RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "read own profile or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

-- ============ COMPANIES ============
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  free_zone   text,
  license_no  text,
  trn         text,
  plan        text not null default 'starter' check (plan in ('starter','growth','pro')),
  status      text not null default 'onboarding' check (status in ('onboarding','active','paused')),
  created_at  timestamptz not null default now()
);
alter table public.companies enable row level security;

create policy "own companies or admin select" on public.companies
  for select using (owner_id = auth.uid() or public.is_admin());
create policy "insert own company" on public.companies
  for insert with check (owner_id = auth.uid());
create policy "update own company or admin" on public.companies
  for update using (owner_id = auth.uid() or public.is_admin());

-- ============ DOCUMENTS ============
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  uploaded_by   uuid not null references public.profiles(id),
  storage_path  text not null,
  original_name text not null,
  kind          text not null default 'other' check (kind in ('invoice','receipt','bank_statement','other')),
  status        text not null default 'new' check (status in ('new','processed')),
  created_at    timestamptz not null default now()
);
alter table public.documents enable row level security;

create or replace function public.owns_company(cid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (select 1 from public.companies where id = cid and owner_id = auth.uid());
$$;

create policy "company docs select" on public.documents
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "company docs insert" on public.documents
  for insert with check (public.owns_company(company_id) or public.is_admin());
create policy "company docs update admin" on public.documents
  for update using (public.is_admin());

-- ============ COMPLIANCE ITEMS ============
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
alter table public.compliance_items enable row level security;

create policy "compliance select" on public.compliance_items
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "compliance write admin" on public.compliance_items
  for insert with check (public.is_admin());
create policy "compliance update admin" on public.compliance_items
  for update using (public.is_admin());
create policy "compliance delete admin" on public.compliance_items
  for delete using (public.is_admin());

-- ============ MESSAGES ============
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id),
  body        text not null,
  created_at  timestamptz not null default now()
);
alter table public.messages enable row level security;

create policy "messages select" on public.messages
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "messages insert" on public.messages
  for insert with check (
    sender_id = auth.uid() and (public.owns_company(company_id) or public.is_admin())
  );

-- ============ STORAGE ============
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "docs upload own folder" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (public.owns_company((storage.foldername(name))[1]::uuid) or public.is_admin())
  );
create policy "docs read own folder" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (public.owns_company((storage.foldername(name))[1]::uuid) or public.is_admin())
  );

-- ============ ADMIN BOOTSTRAP ============
-- After YOU sign up with your own email, run:
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'kudzaimoyo18@gmail.com');


-- ============================================================
-- 0002_bookkeeping.sql
-- ============================================================

-- Mizan schema v2: real bookkeeping engine
-- transactions, statement imports, vendor memory, tax packs, company members (tax-agent access)
-- Safe to run on top of 0001. Paste into the Supabase SQL Editor and run once.

-- can_access_company() forward-references company_members (created lower down).
-- Postgres validates SQL function bodies at CREATE time, so defer that check.
set check_function_bodies = off;

-- ============ COMPANIES: region + VAT registration ============
alter table public.companies
  add column if not exists region        text not null default 'ae'
    check (region in ('ae','gb')),
  add column if not exists vat_registered boolean not null default true;

-- ============ ACCESS HELPER (owner OR active member OR admin) ============
-- Used for read access so an invited tax agent can see the books.
create or replace function public.can_access_company(cid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select
    public.owns_company(cid)
    or public.is_admin()
    or exists (
      select 1 from public.company_members m
      where m.company_id = cid
        and m.user_id = auth.uid()
        and m.status = 'active'
    );
$$;

-- ============ COMPANY MEMBERS (tax-agent / accountant access) ============
create table if not exists public.company_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  invited_email text not null,
  role          text not null default 'tax_agent'
    check (role in ('owner','accountant','tax_agent','viewer')),
  status        text not null default 'pending'
    check (status in ('pending','active','revoked')),
  invited_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create unique index if not exists company_members_email_idx
  on public.company_members (company_id, lower(invited_email));
alter table public.company_members enable row level security;

drop policy if exists "members select" on public.company_members;
create policy "members select" on public.company_members
  for select using (public.can_access_company(company_id));
drop policy if exists "members insert owner" on public.company_members;
create policy "members insert owner" on public.company_members
  for insert with check (public.owns_company(company_id) or public.is_admin());
drop policy if exists "members update owner" on public.company_members;
create policy "members update owner" on public.company_members
  for update using (public.owns_company(company_id) or public.is_admin());
drop policy if exists "members delete owner" on public.company_members;
create policy "members delete owner" on public.company_members
  for delete using (public.owns_company(company_id) or public.is_admin());

-- Let invited members (e.g. a tax agent) read the company row they were added to.
drop policy if exists "own companies or admin select" on public.companies;
drop policy if exists "companies select access" on public.companies;
create policy "companies select access" on public.companies
  for select using (public.can_access_company(id));

-- Link any pending invites to a user the first time they touch the app.
create or replace function public.link_my_memberships()
returns void
language sql security definer set search_path = public
as $$
  update public.company_members m
  set user_id = auth.uid(), status = 'active'
  where m.user_id is null
    and m.status = 'pending'
    and lower(m.invited_email) = lower((select email from auth.users where id = auth.uid()));
$$;

-- ============ STATEMENT IMPORTS (one CSV upload = one batch) ============
create table if not exists public.statement_imports (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  uploaded_by   uuid not null references public.profiles(id),
  source_name   text not null,
  source_path   text,
  period_label  text,
  row_count     int not null default 0,
  posted_count  int not null default 0,
  review_count  int not null default 0,
  status        text not null default 'committed'
    check (status in ('parsed','committed')),
  created_at    timestamptz not null default now()
);
alter table public.statement_imports enable row level security;

drop policy if exists "imports select" on public.statement_imports;
create policy "imports select" on public.statement_imports
  for select using (public.can_access_company(company_id));
drop policy if exists "imports insert" on public.statement_imports;
create policy "imports insert" on public.statement_imports
  for insert with check (public.owns_company(company_id) or public.is_admin());
drop policy if exists "imports update" on public.statement_imports;
create policy "imports update" on public.statement_imports
  for update using (public.owns_company(company_id) or public.is_admin());

-- ============ TRANSACTIONS (the ledger) ============
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  import_id     uuid references public.statement_imports(id) on delete set null,
  txn_date      date not null,
  description   text not null,
  counterparty  text,
  amount        numeric(14,2) not null,            -- gross, always positive
  direction     text not null check (direction in ('in','out')),
  account_code  text,
  category      text,
  vat_rate      numeric(5,4) not null default 0,   -- 0.05, 0.20, 0
  vat_amount    numeric(14,2) not null default 0,
  net_amount    numeric(14,2) not null default 0,
  status        text not null default 'review'
    check (status in ('posted','review','uncategorized')),
  confidence    numeric(4,3),
  source        text not null default 'manual'
    check (source in ('rule','ai','manual','import','seed')),
  reason        text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  posted_at     timestamptz
);
create index if not exists transactions_company_date_idx
  on public.transactions (company_id, txn_date);
create index if not exists transactions_company_status_idx
  on public.transactions (company_id, status);
alter table public.transactions enable row level security;

drop policy if exists "txn select" on public.transactions;
create policy "txn select" on public.transactions
  for select using (public.can_access_company(company_id));
drop policy if exists "txn insert" on public.transactions;
create policy "txn insert" on public.transactions
  for insert with check (public.owns_company(company_id) or public.is_admin());
drop policy if exists "txn update" on public.transactions;
create policy "txn update" on public.transactions
  for update using (public.owns_company(company_id) or public.is_admin());
drop policy if exists "txn delete" on public.transactions;
create policy "txn delete" on public.transactions
  for delete using (public.owns_company(company_id) or public.is_admin());

-- ============ VENDOR RULES (learned categorization memory) ============
create table if not exists public.vendor_rules (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  match_text   text not null,                      -- normalized lowercase fragment
  account_code text not null,
  category     text not null,
  vat_rate     numeric(5,4) not null default 0,
  direction    text check (direction in ('in','out')),
  hits         int not null default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create unique index if not exists vendor_rules_match_idx
  on public.vendor_rules (company_id, match_text);
alter table public.vendor_rules enable row level security;

drop policy if exists "rules select" on public.vendor_rules;
create policy "rules select" on public.vendor_rules
  for select using (public.can_access_company(company_id));
drop policy if exists "rules write" on public.vendor_rules;
create policy "rules write" on public.vendor_rules
  for insert with check (public.owns_company(company_id) or public.is_admin());
drop policy if exists "rules update" on public.vendor_rules;
create policy "rules update" on public.vendor_rules
  for update using (public.owns_company(company_id) or public.is_admin());

-- ============ TAX PACKS (period close + handoff bundle) ============
create table if not exists public.tax_packs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  period_label    text not null,
  period_start    date,
  period_end      date,
  storage_path    text,
  recipient_email text,
  totals          jsonb,
  status          text not null default 'draft'
    check (status in ('draft','shared','sent')),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);
alter table public.tax_packs enable row level security;

drop policy if exists "packs select" on public.tax_packs;
create policy "packs select" on public.tax_packs
  for select using (public.can_access_company(company_id));
drop policy if exists "packs insert" on public.tax_packs;
create policy "packs insert" on public.tax_packs
  for insert with check (public.owns_company(company_id) or public.is_admin());
drop policy if exists "packs update" on public.tax_packs;
create policy "packs update" on public.tax_packs
  for update using (public.owns_company(company_id) or public.is_admin());

-- ============ STORAGE: allow agents/members to read company files ============
-- Statements (CSV) and packs (xlsx) live under documents/{companyId}/...
drop policy if exists "docs read member" on storage.objects;
create policy "docs read member" on storage.objects
  for select using (
    bucket_id = 'documents'
    and public.can_access_company((storage.foldername(name))[1]::uuid)
  );


-- ============================================================
-- 0003_ledger.sql
-- ============================================================

-- Mizan schema v2: AI-extracted ledger (the "actual accounting" layer)
-- Claude reads an uploaded document and proposes draft ledger lines.
-- A licensed reviewer (admin) edits any column and moves the line draft -> reviewed -> approved.
-- Paste this whole file into the Supabase SQL Editor and run once (after 0001_init.sql).

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
  amount        numeric(14,2) not null default 0,   -- net, excluding VAT
  vat_amount    numeric(14,2) not null default 0,
  confidence    numeric(4,3),                        -- AI self-rated 0..1, null when added by hand
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

-- Clients may read their own ledger (transparency); only admins (the reviewer) may write.
create policy "ledger select" on public.ledger_entries
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "ledger insert admin" on public.ledger_entries
  for insert with check (public.is_admin());
create policy "ledger update admin" on public.ledger_entries
  for update using (public.is_admin());
create policy "ledger delete admin" on public.ledger_entries
  for delete using (public.is_admin());

-- keep updated_at fresh on every edit
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists ledger_touch on public.ledger_entries;
create trigger ledger_touch
  before update on public.ledger_entries
  for each row execute function public.touch_updated_at();


-- ============================================================
-- 0004_accounts.sql
-- ============================================================

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


-- ============================================================
-- 0005_journals.sql
-- ============================================================

-- Mizan schema v4: double-entry journal engine.
-- Run after 0003_accounts.sql. Approved ledger_entries are posted here as
-- balanced journal entries (debits = credits). A deferred constraint trigger
-- enforces the balance at commit time, after all lines for an entry are written.

create table if not exists public.journal_entries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  ledger_entry_id uuid unique references public.ledger_entries(id) on delete cascade, -- null for manual journals
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
  -- a line is one side only: exactly one of debit/credit is non-zero
  constraint one_sided check (not (debit > 0 and credit > 0))
);

create index if not exists journal_entries_company_idx on public.journal_entries (company_id, entry_date);
create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines (account_id);

alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy "journal_entries select" on public.journal_entries
  for select using (public.owns_company(company_id) or public.is_admin());
create policy "journal_entries write admin" on public.journal_entries
  for all using (public.is_admin()) with check (public.is_admin());

-- journal_lines inherit access from their parent entry's company
create or replace function public.journal_line_company(eid uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select company_id from public.journal_entries where id = eid;
$$;

create policy "journal_lines select" on public.journal_lines
  for select using (
    public.owns_company(public.journal_line_company(entry_id)) or public.is_admin()
  );
create policy "journal_lines write admin" on public.journal_lines
  for all using (public.is_admin()) with check (public.is_admin());

-- Balance enforcement: sum(debit) must equal sum(credit) per entry.
-- Deferred so it is checked once, at commit, after all lines are inserted.
create or replace function public.assert_journal_balanced()
returns trigger language plpgsql as $$
declare
  eid uuid := coalesce(new.entry_id, old.entry_id);
  d numeric(14,2);
  c numeric(14,2);
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0)
    into d, c
    from public.journal_lines where entry_id = eid;
  -- ignore fully-deleted entries (no lines left)
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


-- ============================================================
-- 0006_bank.sql
-- ============================================================

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


-- ============================================================
-- 0007_periods.sql
-- ============================================================

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


-- ============================================================
-- 0008_self_serve_accounting.sql
-- ============================================================

-- Mizan schema v7: open the accounting engine to self-serve owners.
--
-- The v2–v6 engine (ledger_entries, accounts, journal_entries, journal_lines,
-- bank_transactions, accounting_periods) shipped admin-write / client-read for a
-- firm-managed model: a licensed reviewer kept the books, the client could only
-- look. Mizan is self-serve — the company OWNER keeps their own books — so every
-- WRITE policy is broadened from is_admin() to owns_company() OR is_admin().
--
-- Reads were already (owns_company OR is_admin), so they are untouched.
-- owns_company()/is_admin() are the same SECURITY DEFINER helpers from 0001_init.
-- Run after 0007_periods.sql.

-- ledger_entries -------------------------------------------------------------
drop policy if exists "ledger insert admin" on public.ledger_entries;
drop policy if exists "ledger update admin" on public.ledger_entries;
drop policy if exists "ledger delete admin" on public.ledger_entries;
create policy "ledger insert own" on public.ledger_entries
  for insert with check (public.owns_company(company_id) or public.is_admin());
create policy "ledger update own" on public.ledger_entries
  for update using (public.owns_company(company_id) or public.is_admin());
create policy "ledger delete own" on public.ledger_entries
  for delete using (public.owns_company(company_id) or public.is_admin());

-- accounts (chart of accounts) ----------------------------------------------
drop policy if exists "accounts insert admin" on public.accounts;
drop policy if exists "accounts update admin" on public.accounts;
drop policy if exists "accounts delete admin" on public.accounts;
create policy "accounts insert own" on public.accounts
  for insert with check (public.owns_company(company_id) or public.is_admin());
create policy "accounts update own" on public.accounts
  for update using (public.owns_company(company_id) or public.is_admin());
create policy "accounts delete own" on public.accounts
  for delete using (public.owns_company(company_id) or public.is_admin());

-- journal_entries ------------------------------------------------------------
drop policy if exists "journal_entries write admin" on public.journal_entries;
create policy "journal_entries write own" on public.journal_entries
  for all using (public.owns_company(company_id) or public.is_admin())
  with check (public.owns_company(company_id) or public.is_admin());

-- journal_lines (scoped through the parent entry's company) ------------------
drop policy if exists "journal_lines write admin" on public.journal_lines;
create policy "journal_lines write own" on public.journal_lines
  for all using (
    public.owns_company(public.journal_line_company(entry_id)) or public.is_admin()
  )
  with check (
    public.owns_company(public.journal_line_company(entry_id)) or public.is_admin()
  );

-- bank_transactions ----------------------------------------------------------
drop policy if exists "bank write admin" on public.bank_transactions;
create policy "bank write own" on public.bank_transactions
  for all using (public.owns_company(company_id) or public.is_admin())
  with check (public.owns_company(company_id) or public.is_admin());

-- accounting_periods ---------------------------------------------------------
drop policy if exists "periods write admin" on public.accounting_periods;
create policy "periods write own" on public.accounting_periods
  for all using (public.owns_company(company_id) or public.is_admin())
  with check (public.owns_company(company_id) or public.is_admin());


-- ============================================================
-- 0009_customers_invoices.sql
-- ============================================================

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


-- ============================================================
-- 0010_invite_upsert_and_docs_rls.sql
-- ============================================================

-- 0010: prod bug fixes — invite upsert + documents RLS/statuses
--
-- 1. inviteAgent crashed with "there is no unique or exclusion constraint
--    matching the ON CONFLICT specification": the upsert targets plain columns
--    (company_id, invited_email) but the unique index was an EXPRESSION index
--    on (company_id, lower(invited_email)), which ON CONFLICT (col, col) can't
--    match. The app already lowercases emails before writing, so a plain-column
--    unique index is safe — normalise + dedupe first, then swap the index.
--
-- 2. documents RLS: updates were admin-only, so any owner-side update (e.g.
--    marking extraction results) silently matched zero rows. Owners may update
--    their own company's documents, same as select/insert. Also widen the
--    status check to allow future in-flight states (reading/failed).

-- ── 1. company_members: plain-column unique index for the upsert ────────────

update public.company_members
  set invited_email = lower(invited_email)
  where invited_email <> lower(invited_email);

-- Keep the best row per (company_id, email): active > pending > revoked,
-- then newest. Everything else is a duplicate left over from case variants.
delete from public.company_members m
using (
  select id,
         row_number() over (
           partition by company_id, invited_email
           order by (status = 'active')::int desc,
                    (status = 'pending')::int desc,
                    created_at desc
         ) as rn
  from public.company_members
) d
where m.id = d.id
  and d.rn > 1;

drop index if exists public.company_members_email_idx;
create unique index company_members_email_idx
  on public.company_members (company_id, invited_email);

-- ── 2. documents: owner updates + wider status vocabulary ───────────────────

alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents add constraint documents_status_check
  check (status in ('new','reading','processed','failed'));

drop policy if exists "company docs update admin" on public.documents;
drop policy if exists "company docs update" on public.documents;
create policy "company docs update" on public.documents
  for update using (public.owns_company(company_id) or public.is_admin());


-- ============================================================
-- 0011_reversals.sql
-- ============================================================

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
