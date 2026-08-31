# Mizan

AI-native accounting and tax compliance for UAE free-zone (and UK) companies.
Upload the paperwork, approve the AI-drafted lines, and the double-entry books,
VAT and corporate-tax figures stay filing-ready.

**Stack:** Next.js 15 (App Router) · Neon Postgres + Drizzle ORM · Better Auth
(self-hosted) · Cloudflare R2 · Anthropic Claude · Tailwind · Vercel.

---

## Setup

You need three things: a Neon database, an R2 bucket, and an Anthropic key.
Authentication needs no third-party account — it runs inside the app. Copy `.env.example` to `.env.local` and fill it in as you go.

```bash
npm install
cp .env.example .env.local
```

### 1. Neon (database)

Create a project at [console.neon.tech](https://console.neon.tech), then copy
the **pooled** connection string — the host ends in
`-pooler.<region>.aws.neon.tech`. Serverless functions open and drop connections
constantly, so the pooler is what keeps you under the connection limit.

```
DATABASE_URL=postgres://...-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

Then create the schema:

```bash
npm run db:migrate
```

That applies `drizzle/0000_init_neon.sql` (21 tables) and
`drizzle/0001_journal_integrity.sql` (the `updated_at` trigger and the deferred
double-entry balance constraint).

### 2. Better Auth (authentication)

Nothing to sign up for: Better Auth runs **inside this app** and stores users,
sessions and password hashes in the same Neon database as the books (the
`user`, `session`, `account` and `verification` tables). Email + password is
enabled; sign-in and sign-up share one form at `/login`, and every auth endpoint
is served from `app/api/auth/[...all]`.

```
BETTER_AUTH_SECRET=      # openssl rand -base64 32
BETTER_AUTH_URL=         # dev: your dev-server origin. prod: the real site URL.
```

`BETTER_AUTH_URL` matters: Better Auth checks the request origin against it, so
a value that disagrees with the port you are actually serving makes it reject
its own sign-in requests. On Vercel it falls back to `VERCEL_URL` if unset.

Note: Neon's own console offers "Neon Auth", which is now a **managed** Better
Auth (it used to be Stack Auth). We deliberately do not use it — its packages
are pre-release (`@neondatabase/auth@0.5.0-beta`) and it puts the login path
behind a beta API. The self-hosted library here is `better-auth@1.7.x`, stable.

Promote yourself to admin after signing up once:

```bash
npm run make-admin you@example.com
```

### 3. Cloudflare R2 (document storage)

Create a bucket (default name `documents`) and an **Object Read & Write** API
token under R2 → Manage API tokens.

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=documents
```

**Keep the bucket private.** The app never exposes bucket credentials; the
browser uploads and downloads through short-lived presigned URLs minted
server-side, after the caller has been checked against the tenant guard.

Because the browser PUTs directly to R2, the bucket needs a CORS rule. R2 →
your bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.vercel.app"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Without this, uploads fail in the browser with an opaque network error.

### 4. Anthropic

```
ANTHROPIC_API_KEY=
```

Powers AI categorisation and document extraction. Without it the app still
works — bookkeeping falls back to the rules engine and the AI ledger is off.

### 5. Run it

```bash
npm run dev
```

Create your account at `/login`, fill in the onboarding form, then approve the
company from `/admin` (admins can switch a company from `onboarding` to
`active`).

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (accounting, tax, summary) |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly (dev only — skips migration files) |
| `npm run db:studio` | Drizzle Studio, a browser UI over the data |
| `npm run make-admin <email>` | Promote a signed-up user to admin |
| `npx tsx scripts/apply-sql.ts <file>` | Apply raw SQL (triggers/functions `db:push` skips) |

---

## Architecture notes

### Tenancy is enforced in the application, not the database

This is the single most important thing to know before changing data code.

The app previously ran on Supabase, where every table carried row-level security
policies keyed on `auth.uid()`. A query that forgot its `company_id` filter
simply returned nothing — the database was the backstop.

Neon has no request-scoped database user, so that backstop does not exist. The
rules that replace it:

- **`lib/db/tenant.ts` is the chokepoint.** `requireTenant()` resolves who is
  asking and which company they are in; `requireWritableTenant()` adds the
  owner/admin write check that `owns_company()` used to do. Invited accountants
  and tax agents resolve as read-only members.
- **`onlyThisCompany(table, tenant, ...extra)` builds every WHERE clause.** It
  stitches the session's `company_id` into the query, and it is a type error to
  pass a table that has no `company_id` column.
- **`db` from `lib/db` is unscoped and should stay rare.** Use it for
  migrations, seeds, and the deliberately cross-tenant admin console (gated by
  `requireAdmin()`), not for anything driven by a user's own session.
- **Never take a `company_id` from a form field on a self-serve surface.** The
  admin console does take one — that is what an admin console is for — but every
  admin statement still carries its own company filter so a stray id cannot
  cross tenants.

The database still enforces what it can on its own: `CHECK` constraints, unique
indexes, foreign keys, and the deferred trigger that rejects an unbalanced
journal entry at commit.

### Storage

Object keys are always `<company_id>/<folder>/<timestamp>-<name>`, and
`assertCompanyKey()` re-checks that prefix on every signed URL and every read —
so a client that rewrites a key gets a signature for its own folder or nothing.
This replaces the old storage RLS policies that matched the folder name against
the caller's company.

### Money

Numeric columns are `numeric(14,2)` and cross the driver boundary as **strings**,
deliberately — binding a JS float would re-round money in transit. Convert with
`Number()` at the point of calculation and pass `String(...)` on the way in.

### Transactions

The accounting engine uses real interactive transactions (the Neon WebSocket
driver, not `neon-http`, which cannot hold one open). Posting a journal writes
the entry and all of its lines in one transaction, so a half-written,
unbalanced journal cannot exist. Invoice numbering takes a row lock via
`UPDATE ... RETURNING` in the same transaction as the insert, so two concurrent
invoices can never share a number and a failed invoice does not burn one.

---

## Deploying

Push to Vercel and set the same environment variables in the project settings —
including `BETTER_AUTH_SECRET` and a `BETTER_AUTH_URL` pointing at the real
domain. Add that domain to the R2 CORS `AllowedOrigins` list.

For schema changes, run `npm run db:push` (or `db:migrate`) against the
production `DATABASE_URL` first, then apply any raw-SQL migration the DSL cannot
express:

```bash
npx tsx scripts/apply-sql.ts drizzle/0001_journal_integrity.sql
```
