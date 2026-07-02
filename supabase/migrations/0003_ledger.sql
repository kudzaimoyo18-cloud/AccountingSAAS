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
