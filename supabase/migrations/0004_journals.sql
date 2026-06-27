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
