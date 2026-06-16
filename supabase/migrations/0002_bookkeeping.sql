-- Mizan schema v2: real bookkeeping engine
-- transactions, statement imports, vendor memory, tax packs, company members (tax-agent access)
-- Safe to run on top of 0001. Paste into the Supabase SQL Editor and run once.

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
