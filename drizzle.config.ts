import type { Config } from "drizzle-kit";

// Drizzle Kit config. The authoritative DDL is hand-maintained in
// db/NEON_SETUP.sql (it carries the CHECK constraints and integrity triggers
// that the ORM schema can't express); this config is here for `drizzle-kit
// studio`/introspection against Neon during development.
export default {
  schema: "./lib/db/schema.ts",
  out: "./db/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
} satisfies Config;
