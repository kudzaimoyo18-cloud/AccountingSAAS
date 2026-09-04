// Drizzle schema for Neon Postgres.
//
// Ported 1:1 from the Supabase migrations (supabase/migrations/0001-0010) with
// two deliberate changes:
//
//   1. User ids are `text`, not `uuid`. Supabase issued uuid ids from
//      auth.users; Stack Auth (Neon Auth) issues string ids and syncs them into
//      neon_auth.users_sync. Everything that referenced a user — profiles.id,
//      companies.owner_id, *.created_by — is text now.
//   2. No row-level security. Supabase enforced tenancy in the database via
//      owns_company()/can_access_company() policies keyed on auth.uid(). Neon
//      has no request-scoped database user, so tenancy is enforced in the app:
//      every read and write goes through the scoped helpers in lib/db/tenant.ts,
//      which inject company_id from the session. The raw client stays private.
//
// CHECK constraints and unique indexes are preserved, so the database still
// rejects bad data on its own.
import {
  pgTable,
  text,
  uuid,
  integer,
  bigint,
  boolean,
  numeric,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Neon Auth (Stack Auth) note.
//
// Neon mirrors every Stack Auth user into neon_auth.users_sync, a table Neon
// owns and manages. It is deliberately NOT declared here: declaring it would
// make drizzle-kit try to create and migrate it, and a foreign key onto it
// would break when a user is deleted. The app keeps its own `profiles` row per
// user (materialised on first request, see lib/db/tenant.ts) and reads names
// and emails from there. Query users_sync with raw SQL if you ever need it.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Waitlist
// ---------------------------------------------------------------------------
export const waitlist = pgTable(
  "waitlist",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull(),
    company: text("company"),
    stage: text("stage"),
    region: text("region").default("ae"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("waitlist_email_idx").on(sql`lower(${t.email})`)],
);

// ---------------------------------------------------------------------------
// Profiles — app-owned data about a Stack Auth user. `id` is the Stack user id.
// ---------------------------------------------------------------------------
export const profiles = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name"),
    email: text("email"),
    role: text("role").notNull().default("client"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("profiles_role_check", sql`${t.role} in ('client','admin')`),
    index("profiles_email_idx").on(sql`lower(${t.email})`),
  ],
);

// ---------------------------------------------------------------------------
// Companies — the tenant boundary. Every scoped table hangs off company_id.
// ---------------------------------------------------------------------------
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    freeZone: text("free_zone"),
    licenseNo: text("license_no"),
    trn: text("trn"),
    plan: text("plan").notNull().default("starter"),
    status: text("status").notNull().default("onboarding"),
    region: text("region").notNull().default("ae"),
    vatRegistered: boolean("vat_registered").notNull().default(true),
    invoiceCounter: integer("invoice_counter").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("companies_plan_check", sql`${t.plan} in ('starter','growth','pro')`),
    check("companies_status_check", sql`${t.status} in ('onboarding','active','paused')`),
    check("companies_region_check", sql`${t.region} in ('ae','gb')`),
    index("companies_owner_idx").on(t.ownerId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Company members — invited accountants and tax agents.
// ---------------------------------------------------------------------------
export const companyMembers = pgTable(
  "company_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => profiles.id, { onDelete: "set null" }),
    invitedEmail: text("invited_email").notNull(),
    role: text("role").notNull().default("tax_agent"),
    status: text("status").notNull().default("pending"),
    invitedBy: text("invited_by").references(() => profiles.id, { onDelete: "set null" }),
    // Unguessable acceptance token. Membership is granted by whoever opens this
    // link while signed in — NOT by matching the signed-up email address.
    // Trusting the email would let anyone who signs up as the invited address
    // (sign-up needs no verification) walk into the company's books.
    inviteToken: text("invite_token").unique(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Plain-column unique index, not an expression index: the invite upsert
    // targets ON CONFLICT (company_id, invited_email). Emails are lowercased in
    // the app before every write. See migration 0010 for the history here.
    uniqueIndex("company_members_email_idx").on(t.companyId, t.invitedEmail),
    index("company_members_user_idx").on(t.userId, t.status),
    check(
      "company_members_role_check",
      sql`${t.role} in ('owner','accountant','tax_agent','viewer')`,
    ),
    check("company_members_status_check", sql`${t.status} in ('pending','active','revoked')`),
  ],
);

// ---------------------------------------------------------------------------
// Documents — uploaded files. storage_path is an R2 object key.
// ---------------------------------------------------------------------------
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => profiles.id),
    storagePath: text("storage_path").notNull(),
    originalName: text("original_name").notNull(),
    kind: text("kind").notNull().default("other"),
    status: text("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("documents_company_idx").on(t.companyId, t.createdAt),
    check("documents_kind_check", sql`${t.kind} in ('invoice','receipt','bank_statement','other')`),
    check("documents_status_check", sql`${t.status} in ('new','reading','processed','failed')`),
  ],
);

// ---------------------------------------------------------------------------
// Compliance items and messages
// ---------------------------------------------------------------------------
export const complianceItems = pgTable(
  "compliance_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    dueDate: date("due_date"),
    status: text("status").notNull().default("upcoming"),
    filedAt: timestamp("filed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("compliance_company_idx").on(t.companyId, t.dueDate),
    check(
      "compliance_kind_check",
      sql`${t.kind} in ('vat_return','corporate_tax','bookkeeping','registration','other')`,
    ),
    check(
      "compliance_status_check",
      sql`${t.status} in ('upcoming','in_progress','filed','overdue')`,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => profiles.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_company_idx").on(t.companyId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Bookkeeping: statement imports, transactions, learned vendor rules, tax packs
// ---------------------------------------------------------------------------
export const statementImports = pgTable(
  "statement_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => profiles.id),
    sourceName: text("source_name").notNull(),
    sourcePath: text("source_path"),
    periodLabel: text("period_label"),
    rowCount: integer("row_count").notNull().default(0),
    postedCount: integer("posted_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    status: text("status").notNull().default("committed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("statement_imports_company_idx").on(t.companyId, t.createdAt),
    check("statement_imports_status_check", sql`${t.status} in ('parsed','committed')`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    importId: uuid("import_id").references(() => statementImports.id, { onDelete: "set null" }),
    txnDate: date("txn_date").notNull(),
    description: text("description").notNull(),
    counterparty: text("counterparty"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(), // gross, always positive
    direction: text("direction").notNull(),
    accountCode: text("account_code"),
    category: text("category"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 4 }).notNull().default("0"),
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("review"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    source: text("source").notNull().default("manual"),
    reason: text("reason"),
    createdBy: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
  },
  (t) => [
    index("transactions_company_date_idx").on(t.companyId, t.txnDate),
    index("transactions_company_status_idx").on(t.companyId, t.status),
    check("transactions_direction_check", sql`${t.direction} in ('in','out')`),
    check("transactions_status_check", sql`${t.status} in ('posted','review','uncategorized')`),
    check("transactions_source_check", sql`${t.source} in ('rule','ai','manual','import','seed')`),
  ],
);

export const vendorRules = pgTable(
  "vendor_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    matchText: text("match_text").notNull(), // normalised lowercase fragment
    accountCode: text("account_code").notNull(),
    category: text("category").notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 4 }).notNull().default("0"),
    direction: text("direction"),
    hits: integer("hits").notNull().default(0),
    createdBy: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("vendor_rules_match_idx").on(t.companyId, t.matchText),
    check(
      "vendor_rules_direction_check",
      sql`${t.direction} is null or ${t.direction} in ('in','out')`,
    ),
  ],
);

export const taxPacks = pgTable(
  "tax_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    periodLabel: text("period_label").notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    storagePath: text("storage_path"),
    recipientEmail: text("recipient_email"),
    totals: jsonb("totals"),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tax_packs_company_idx").on(t.companyId, t.createdAt),
    check("tax_packs_status_check", sql`${t.status} in ('draft','shared','sent')`),
  ],
);

// ---------------------------------------------------------------------------
// Accounting engine: ledger, chart of accounts, journals, bank, periods
// ---------------------------------------------------------------------------
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    entryDate: date("entry_date"),
    description: text("description").notNull().default(""),
    counterparty: text("counterparty"),
    category: text("category").notNull().default("uncategorised"),
    direction: text("direction").notNull().default("expense"),
    currency: text("currency").notNull().default("AED"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"), // net, ex-VAT
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }), // AI self-rated 0..1
    source: text("source").notNull().default("ai"),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    reviewedBy: text("reviewed_by").references(() => profiles.id, { onDelete: "set null" }),
    // Reversal audit trail. These columns already existed in the database from
    // an earlier iteration; no code path writes them yet, but they are declared
    // here so migrations stay additive rather than dropping a designed feature.
    reversalOf: uuid("reversal_of"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ledger_company_idx").on(t.companyId, t.entryDate),
    index("ledger_document_idx").on(t.documentId),
    check("ledger_direction_check", sql`${t.direction} in ('income','expense')`),
    check("ledger_source_check", sql`${t.source} in ('ai','manual')`),
    check("ledger_status_check", sql`${t.status} in ('draft','reviewed','approved')`),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // e.g. "5300"
    name: text("name").notNull(), // e.g. "Utilities"
    type: text("type").notNull(),
    vatTreatment: text("vat_treatment").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accounts_company_code_idx").on(t.companyId, t.code),
    check(
      "accounts_type_check",
      sql`${t.type} in ('asset','liability','equity','income','expense')`,
    ),
    check("accounts_vat_treatment_check", sql`${t.vatTreatment} in ('none','input','output')`),
  ],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    // null for manual journals; unique so one ledger entry posts at most once
    ledgerEntryId: uuid("ledger_entry_id")
      .unique()
      .references(() => ledgerEntries.id, { onDelete: "cascade" }),
    entryDate: date("entry_date").notNull(),
    memo: text("memo").notNull().default(""),
    source: text("source").notNull().default("ledger"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("journal_entries_company_idx").on(t.companyId, t.entryDate),
    check("journal_entries_source_check", sql`${t.source} in ('ledger','manual','adjustment')`),
  ],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      // Cascade so a company delete can unwind its chart of accounts. Without
      // this the whole delete was refused — see drizzle/0002_deletable.sql.
      .references(() => accounts.id, { onDelete: "cascade" }),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
  },
  (t) => [
    index("journal_lines_entry_idx").on(t.entryId),
    index("journal_lines_account_idx").on(t.accountId),
    check("journal_lines_debit_check", sql`${t.debit} >= 0`),
    check("journal_lines_credit_check", sql`${t.credit} >= 0`),
    // A line is one side only: at most one of debit/credit is non-zero.
    check("one_sided", sql`not (${t.debit} > 0 and ${t.credit} > 0)`),
  ],
);

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    txnDate: date("txn_date").notNull(),
    description: text("description").notNull().default(""),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(), // signed: in > 0, out < 0
    currency: text("currency").notNull().default("AED"),
    matchedEntryId: uuid("matched_entry_id").references(() => journalEntries.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("unmatched"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bank_txn_company_idx").on(t.companyId, t.txnDate),
    index("bank_txn_status_idx").on(t.companyId, t.status),
    check("bank_status_check", sql`${t.status} in ('unmatched','matched','ignored')`),
  ],
);

export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // e.g. "Q2 2026"
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: text("status").notNull().default("open"),
    vatOutput: numeric("vat_output", { precision: 14, scale: 2 }).notNull().default("0"),
    vatInput: numeric("vat_input", { precision: 14, scale: 2 }).notNull().default("0"),
    vatNet: numeric("vat_net", { precision: 14, scale: 2 }).notNull().default("0"),
    taxableProfit: numeric("taxable_profit", { precision: 14, scale: 2 }).notNull().default("0"),
    corporateTax: numeric("corporate_tax", { precision: 14, scale: 2 }).notNull().default("0"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("periods_company_idx").on(t.companyId, t.endDate),
    check("periods_status_check", sql`${t.status} in ('open','closed')`),
  ],
);

// ---------------------------------------------------------------------------
// Customers and invoicing
// ---------------------------------------------------------------------------
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    trn: text("trn"), // customer VAT/TRN, needed for FTA e-invoicing later
    address: text("address"),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    createdBy: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customers_company_name_idx").on(t.companyId, t.name)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    number: text("number").notNull(), // e.g. INV-0007
    seq: integer("seq").notNull(),
    issueDate: date("issue_date").notNull().defaultNow(),
    dueDate: date("due_date"),
    currency: text("currency").notNull().default("AED"), // ae -> AED, gb -> GBP
    status: text("status").notNull().default("draft"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"), // net of VAT
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"), // gross
    notes: text("notes"),
    shareToken: text("share_token").unique(), // unguessable public-link token
    sentAt: timestamp("sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ledgerEntryId: uuid("ledger_entry_id").references(() => ledgerEntries.id, {
      onDelete: "set null",
    }),
    // Future-proofing (columns only, no logic yet):
    paymentLink: text("payment_link"), // per-invoice pay link (Ziina/Stripe later)
    placeOfSupply: text("place_of_supply"), // FTA e-invoicing
    einvoice: jsonb("einvoice"), // ASP/Peppol metadata later
    createdBy: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_company_number_idx").on(t.companyId, t.number),
    index("invoices_company_status_idx").on(t.companyId, t.status),
    index("invoices_company_issue_idx").on(t.companyId, t.issueDate),
    check("invoices_status_check", sql`${t.status} in ('draft','sent','paid','void')`),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    // Denormalised tenant key: lets a line be scoped without joining the invoice.
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull().default("0"), // ex-VAT
    vatRate: numeric("vat_rate", { precision: 5, scale: 4 }).notNull().default("0"),
    lineNet: numeric("line_net", { precision: 14, scale: 2 }).notNull().default("0"),
    lineVat: numeric("line_vat", { precision: 14, scale: 2 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
  },
  (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId, t.position)],
);

// ---------------------------------------------------------------------------
// Relations — used by the db.query.* relational API.
// ---------------------------------------------------------------------------
export const companiesRelations = relations(companies, ({ one, many }) => ({
  owner: one(profiles, { fields: [companies.ownerId], references: [profiles.id] }),
  members: many(companyMembers),
  documents: many(documents),
  customers: many(customers),
  invoices: many(invoices),
}));

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(companies, { fields: [companyMembers.companyId], references: [companies.id] }),
  user: one(profiles, { fields: [companyMembers.userId], references: [profiles.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  company: one(companies, { fields: [customers.companyId], references: [companies.id] }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  company: one(companies, { fields: [invoices.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  lines: many(invoiceLines),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  company: one(companies, { fields: [journalEntries.companyId], references: [companies.id] }),
  ledgerEntry: one(ledgerEntries, {
    fields: [journalEntries.ledgerEntryId],
    references: [ledgerEntries.id],
  }),
  lines: many(journalLines),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  entry: one(journalEntries, { fields: [journalLines.entryId], references: [journalEntries.id] }),
  account: one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  company: one(companies, { fields: [ledgerEntries.companyId], references: [companies.id] }),
  document: one(documents, { fields: [ledgerEntries.documentId], references: [documents.id] }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  company: one(companies, { fields: [documents.companyId], references: [companies.id] }),
  ledgerEntries: many(ledgerEntries),
}));

// Convenience row types for the app layer.
export type Profile = typeof profiles.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalLine = typeof journalLines.$inferSelect;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type AccountingPeriod = typeof accountingPeriods.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type CompanyMember = typeof companyMembers.$inferSelect;
export type StatementImport = typeof statementImports.$inferSelect;
export type VendorRule = typeof vendorRules.$inferSelect;
export type TaxPack = typeof taxPacks.$inferSelect;
