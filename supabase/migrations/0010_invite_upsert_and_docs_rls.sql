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
