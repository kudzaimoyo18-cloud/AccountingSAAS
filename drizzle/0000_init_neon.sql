CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"vat_output" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_input" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable_profit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"corporate_tax" numeric(14, 2) DEFAULT '0' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periods_status_check" CHECK ("accounting_periods"."status" in ('open','closed'))
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"vat_treatment" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" in ('asset','liability','equity','income','expense')),
	CONSTRAINT "accounts_vat_treatment_check" CHECK ("accounts"."vat_treatment" in ('none','input','output'))
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"txn_date" date NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"matched_entry_id" uuid,
	"status" text DEFAULT 'unmatched' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_status_check" CHECK ("bank_transactions"."status" in ('unmatched','matched','ignored'))
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"free_zone" text,
	"license_no" text,
	"trn" text,
	"plan" text DEFAULT 'starter' NOT NULL,
	"status" text DEFAULT 'onboarding' NOT NULL,
	"region" text DEFAULT 'ae' NOT NULL,
	"vat_registered" boolean DEFAULT true NOT NULL,
	"invoice_counter" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_plan_check" CHECK ("companies"."plan" in ('starter','growth','pro')),
	CONSTRAINT "companies_status_check" CHECK ("companies"."status" in ('onboarding','active','paused')),
	CONSTRAINT "companies_region_check" CHECK ("companies"."region" in ('ae','gb'))
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text,
	"invited_email" text NOT NULL,
	"role" text DEFAULT 'tax_agent' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_members_role_check" CHECK ("company_members"."role" in ('owner','accountant','tax_agent','viewer')),
	CONSTRAINT "company_members_status_check" CHECK ("company_members"."status" in ('pending','active','revoked'))
);
--> statement-breakpoint
CREATE TABLE "compliance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"filed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compliance_kind_check" CHECK ("compliance_items"."kind" in ('vat_return','corporate_tax','bookkeeping','registration','other')),
	CONSTRAINT "compliance_status_check" CHECK ("compliance_items"."status" in ('upcoming','in_progress','filed','overdue'))
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"trn" text,
	"address" text,
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"storage_path" text NOT NULL,
	"original_name" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_kind_check" CHECK ("documents"."kind" in ('invoice','receipt','bank_statement','other')),
	CONSTRAINT "documents_status_check" CHECK ("documents"."status" in ('new','reading','processed','failed'))
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"qty" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"line_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"number" text NOT NULL,
	"seq" integer NOT NULL,
	"issue_date" date DEFAULT now() NOT NULL,
	"due_date" date,
	"currency" text DEFAULT 'AED' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"share_token" text,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"ledger_entry_id" uuid,
	"payment_link" text,
	"place_of_supply" text,
	"einvoice" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_share_token_unique" UNIQUE("share_token"),
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" in ('draft','sent','paid','void'))
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"ledger_entry_id" uuid,
	"entry_date" date NOT NULL,
	"memo" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'ledger' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_ledger_entry_id_unique" UNIQUE("ledger_entry_id"),
	CONSTRAINT "journal_entries_source_check" CHECK ("journal_entries"."source" in ('ledger','manual','adjustment'))
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "journal_lines_debit_check" CHECK ("journal_lines"."debit" >= 0),
	CONSTRAINT "journal_lines_credit_check" CHECK ("journal_lines"."credit" >= 0),
	CONSTRAINT "one_sided" CHECK (not ("journal_lines"."debit" > 0 and "journal_lines"."credit" > 0))
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_id" uuid,
	"entry_date" date,
	"description" text DEFAULT '' NOT NULL,
	"counterparty" text,
	"category" text DEFAULT 'uncategorised' NOT NULL,
	"direction" text DEFAULT 'expense' NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"confidence" numeric(4, 3),
	"source" text DEFAULT 'ai' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_direction_check" CHECK ("ledger_entries"."direction" in ('income','expense')),
	CONSTRAINT "ledger_source_check" CHECK ("ledger_entries"."source" in ('ai','manual')),
	CONSTRAINT "ledger_status_check" CHECK ("ledger_entries"."status" in ('draft','reviewed','approved'))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text,
	"email" text,
	"role" text DEFAULT 'client' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_role_check" CHECK ("profiles"."role" in ('client','admin'))
);
--> statement-breakpoint
CREATE TABLE "statement_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"uploaded_by" text NOT NULL,
	"source_name" text NOT NULL,
	"source_path" text,
	"period_label" text,
	"row_count" integer DEFAULT 0 NOT NULL,
	"posted_count" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'committed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statement_imports_status_check" CHECK ("statement_imports"."status" in ('parsed','committed'))
);
--> statement-breakpoint
CREATE TABLE "tax_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"period_label" text NOT NULL,
	"period_start" date,
	"period_end" date,
	"storage_path" text,
	"recipient_email" text,
	"totals" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_packs_status_check" CHECK ("tax_packs"."status" in ('draft','shared','sent'))
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"import_id" uuid,
	"txn_date" date NOT NULL,
	"description" text NOT NULL,
	"counterparty" text,
	"amount" numeric(14, 2) NOT NULL,
	"direction" text NOT NULL,
	"account_code" text,
	"category" text,
	"vat_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'review' NOT NULL,
	"confidence" numeric(4, 3),
	"source" text DEFAULT 'manual' NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone,
	CONSTRAINT "transactions_direction_check" CHECK ("transactions"."direction" in ('in','out')),
	CONSTRAINT "transactions_status_check" CHECK ("transactions"."status" in ('posted','review','uncategorized')),
	CONSTRAINT "transactions_source_check" CHECK ("transactions"."source" in ('rule','ai','manual','import','seed'))
);
--> statement-breakpoint
CREATE TABLE "vendor_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"match_text" text NOT NULL,
	"account_code" text NOT NULL,
	"category" text NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"direction" text,
	"hits" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_rules_direction_check" CHECK ("vendor_rules"."direction" is null or "vendor_rules"."direction" in ('in','out'))
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "waitlist_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"company" text,
	"stage" text,
	"region" text DEFAULT 'ae',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_entry_id_journal_entries_id_fk" FOREIGN KEY ("matched_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_ledger_entry_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_ledger_entry_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_packs" ADD CONSTRAINT "tax_packs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_packs" ADD CONSTRAINT "tax_packs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_id_statement_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."statement_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_rules" ADD CONSTRAINT "vendor_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_rules" ADD CONSTRAINT "vendor_rules_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "periods_company_idx" ON "accounting_periods" USING btree ("company_id","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_company_code_idx" ON "accounts" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "bank_txn_company_idx" ON "bank_transactions" USING btree ("company_id","txn_date");--> statement-breakpoint
CREATE INDEX "bank_txn_status_idx" ON "bank_transactions" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "companies_owner_idx" ON "companies" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "company_members_email_idx" ON "company_members" USING btree ("company_id","invited_email");--> statement-breakpoint
CREATE INDEX "company_members_user_idx" ON "company_members" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "compliance_company_idx" ON "compliance_items" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "customers_company_name_idx" ON "customers" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "documents_company_idx" ON "documents" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_company_number_idx" ON "invoices" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "invoices_company_status_idx" ON "invoices" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "invoices_company_issue_idx" ON "invoices" USING btree ("company_id","issue_date");--> statement-breakpoint
CREATE INDEX "journal_entries_company_idx" ON "journal_entries" USING btree ("company_id","entry_date");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_idx" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ledger_company_idx" ON "ledger_entries" USING btree ("company_id","entry_date");--> statement-breakpoint
CREATE INDEX "ledger_document_idx" ON "ledger_entries" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "messages_company_idx" ON "messages" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "profiles_email_idx" ON "profiles" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "statement_imports_company_idx" ON "statement_imports" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "tax_packs_company_idx" ON "tax_packs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_company_date_idx" ON "transactions" USING btree ("company_id","txn_date");--> statement-breakpoint
CREATE INDEX "transactions_company_status_idx" ON "transactions" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_rules_match_idx" ON "vendor_rules" USING btree ("company_id","match_text");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_email_idx" ON "waitlist" USING btree (lower("email"));