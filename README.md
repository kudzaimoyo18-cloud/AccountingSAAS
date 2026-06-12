# Mizan — validation landing

AI-native accounting + tax compliance service for UAE free-zone companies.
This repo is the **demand-validation landing page** with waitlist capture.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Waitlist storage

The `/api/waitlist` route persists signups. It degrades gracefully:

- **With Supabase** (env set) → inserts into a `waitlist` table.
- **Without** → appends to `data/waitlist.json` (gitignored). Good enough to start.

### Supabase setup (optional)

1. Create a project, then run:

   ```sql
   create table public.waitlist (
     id          bigint generated always as identity primary key,
     email       text not null,
     company     text,
     stage       text,
     created_at  timestamptz not null default now()
   );
   create unique index waitlist_email_idx on public.waitlist (lower(email));
   ```

2. Copy `.env.example` to `.env.local` and fill:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

   The service-role key is server-only (used in the API route) — never exposed to the client.

## Stack

Next.js (App Router) · Tailwind · Supabase (optional) · Fraunces + Inter.

## Next steps

- Wire Supabase + deploy to Vercel
- Add analytics (Plausible/PostHog) to measure landing → waitlist conversion
- Build the client portal + internal AI bookkeeping engine once demand is proven
