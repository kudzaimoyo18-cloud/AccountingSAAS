// Neon (Postgres) connection for Drizzle.
//
// Uses the pooled WebSocket driver (not neon-http) because the double-entry
// engine posts journal lines inside a transaction — the debit=credit balance
// check is a DEFERRABLE constraint trigger enforced at COMMIT, which only works
// inside a real transaction. Vercel's functions run under Node, so the driver
// needs a WebSocket implementation.

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

// Reuse the pool across warm invocations instead of opening one per request.
// Vercel's Neon integration may expose the pooled URL as DATABASE_URL or
// POSTGRES_URL — accept either.
const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

const globalForDb = globalThis as unknown as { _mizanPool?: Pool };
const pool = globalForDb._mizanPool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") globalForDb._mizanPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
