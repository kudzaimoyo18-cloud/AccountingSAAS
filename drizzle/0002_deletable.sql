-- Make companies and users actually deletable.
--
-- Two problems this fixes:
--
-- 1. Deleting a company cascaded into `accounts`, but `journal_lines.account_id`
--    had no delete rule, so Postgres refused the whole delete. There was no
--    working company-deletion path at all.
--
-- 2. Deleting a user was blocked by every nullable `profiles.id` reference.
--    These columns are attribution ("who created this"), not ownership, so the
--    row should outlive the person: set them null instead of blocking.
--
-- The not-null profile references (documents.uploaded_by, messages.sender_id,
-- statement_imports.uploaded_by) are deliberately left alone. Those rows are
-- company-scoped and disappear with the company, so they never block a delete —
-- and nulling them would lose attribution that the books rely on.
--
-- Required for Google Play: the store requires a working account-deletion path,
-- in-app and on the web.

alter table journal_lines
  drop constraint journal_lines_account_id_accounts_id_fk,
  add constraint journal_lines_account_id_accounts_id_fk
    foreign key (account_id) references accounts (id) on delete cascade;

alter table company_members
  drop constraint company_members_invited_by_profiles_id_fk,
  add constraint company_members_invited_by_profiles_id_fk
    foreign key (invited_by) references profiles (id) on delete set null;

alter table customers
  drop constraint customers_created_by_profiles_id_fk,
  add constraint customers_created_by_profiles_id_fk
    foreign key (created_by) references profiles (id) on delete set null;

alter table invoices
  drop constraint invoices_created_by_profiles_id_fk,
  add constraint invoices_created_by_profiles_id_fk
    foreign key (created_by) references profiles (id) on delete set null;

alter table ledger_entries
  drop constraint ledger_entries_reviewed_by_profiles_id_fk,
  add constraint ledger_entries_reviewed_by_profiles_id_fk
    foreign key (reviewed_by) references profiles (id) on delete set null;

alter table tax_packs
  drop constraint tax_packs_created_by_profiles_id_fk,
  add constraint tax_packs_created_by_profiles_id_fk
    foreign key (created_by) references profiles (id) on delete set null;

alter table transactions
  drop constraint transactions_created_by_profiles_id_fk,
  add constraint transactions_created_by_profiles_id_fk
    foreign key (created_by) references profiles (id) on delete set null;

alter table vendor_rules
  drop constraint vendor_rules_created_by_profiles_id_fk,
  add constraint vendor_rules_created_by_profiles_id_fk
    foreign key (created_by) references profiles (id) on delete set null;
