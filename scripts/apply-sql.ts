// Apply a raw .sql file to the database. Used for the parts of the schema that
// Drizzle's DSL cannot express (triggers, functions) and that `db:push`
// therefore never touches.
//
//   npx tsx scripts/apply-sql.ts drizzle/0001_journal_integrity.sql
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { Pool } from "@neondatabase/serverless";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/apply-sql.ts <path-to.sql>");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — add it to .env.local first.");
    process.exit(1);
  }

  const sql = readFileSync(file, "utf8");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    console.log(`Applied ${file}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
