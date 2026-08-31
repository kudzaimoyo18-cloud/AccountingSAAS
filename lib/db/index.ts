import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as appSchema from "./schema";
import * as authSchema from "./auth-schema";

// The application's tables plus Better Auth's own. Merged so one Drizzle client
// serves both, and so drizzle-kit manages them as a single schema.
const schema = { ...appSchema, ...authSchema };

// The WebSocket driver (not neon-http) because the accounting engine needs real
// interactive transactions: posting a journal writes the entry and all of its
// lines, and a half-written journal would be unbalanced books. neon-http cannot
// hold a transaction open across statements.
//
// Prefer Node's built-in WebSocket (Node 22+). The `ws` package is only used as
// a fallback on older runtimes: when Next bundles it, its optional native
// `bufferutil` addon can resolve to a broken build, and every query then dies
// with "bufferUtil.mask is not a function" / "Connection terminated
// unexpectedly". Requiring it lazily keeps it out of the bundle entirely when
// the global exists.
if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

type Db = NeonDatabase<typeof schema>;

// One pool per process. Next.js dev reloads modules on every edit, so stash it
// on globalThis or each reload leaks a pool until Neon refuses new connections.
const globalForDb = globalThis as unknown as { __mizanDb?: Db };

function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy your Neon connection string (the pooled one, " +
        "ending in -pooler.<region>.aws.neon.tech) into .env.local — see README.",
    );
  }

  const pool = new Pool({
    connectionString: url,
    // Serverless functions are short-lived and Neon's pooler fans out for us.
    max: 5,
    idleTimeoutMillis: 30_000,
  });

  return drizzle(pool, { schema });
}

function getDb(): Db {
  const existing = globalForDb.__mizanDb;
  if (existing) return existing;
  const created = connect();
  globalForDb.__mizanDb = created;
  return created;
}

/**
 * The raw, UNSCOPED database handle.
 *
 * Supabase enforced tenant isolation in Postgres with RLS. Neon has no
 * request-scoped database user, so isolation is this application's job. Reaching
 * for `db` directly means you are responsible for every company_id filter
 * yourself, and a forgotten one leaks another tenant's books.
 *
 * Use the helpers in lib/db/tenant.ts for anything user-facing. `db` is for
 * migrations, seeds, webhooks, and the deliberately cross-tenant admin queries.
 *
 * Connecting is deferred to the first actual query: `next build` imports every
 * route to collect page data, and a connection opened at module scope would
 * make the build itself require DATABASE_URL (and a reachable database).
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
  has(_target, prop) {
    return Reflect.has(getDb() as object, prop);
  },
});

export { schema };
export * from "./schema";
export * from "./auth-schema";
