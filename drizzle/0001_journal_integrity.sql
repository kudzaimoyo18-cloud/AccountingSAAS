-- Database-level guarantees that Drizzle's schema DSL cannot express.
-- Carried over from the Supabase migrations (0003_ledger.sql, 0005_journals.sql)
-- so the books stay correct even if a future code path forgets to.

-- ── ledger_entries.updated_at ───────────────────────────────────────────────
-- The app sets updated_at on every write it knows about; this makes it true for
-- writes it does not (a manual fix in psql, a future background job).
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ledger_touch ON public.ledger_entries;
CREATE TRIGGER ledger_touch
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Double-entry balance enforcement ────────────────────────────────────────
-- sum(debit) must equal sum(credit) for every journal entry. DEFERRABLE
-- INITIALLY DEFERRED so it is checked once at COMMIT, after every line of the
-- entry has been inserted — a per-statement check would fire on the first line
-- and reject a perfectly good balanced entry mid-write.
--
-- This is the last line of defence for the integrity of the books: unbalanced
-- journals make the trial balance, P&L, and balance sheet silently wrong.
CREATE OR REPLACE FUNCTION public.assert_journal_balanced()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  eid uuid := COALESCE(NEW.entry_id, OLD.entry_id);
  d numeric(14,2);
  c numeric(14,2);
BEGIN
  SELECT COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
    INTO d, c
    FROM public.journal_lines WHERE entry_id = eid;

  -- No lines left (the whole entry was deleted) — nothing to balance.
  IF d IS NULL THEN RETURN NULL; END IF;

  IF d <> c THEN
    RAISE EXCEPTION 'journal entry % is unbalanced: debit % <> credit %', eid, d, c;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS journal_balanced ON public.journal_lines;
CREATE CONSTRAINT TRIGGER journal_balanced
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_journal_balanced();
