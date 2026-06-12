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
