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
