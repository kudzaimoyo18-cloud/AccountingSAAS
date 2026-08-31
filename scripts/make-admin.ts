// Promote a user to admin, so they can reach /admin.
//
// Supabase did this with a hand-run SQL UPDATE against auth.users. Here the
// profile row is keyed on the Stack Auth user id and carries the email, so you
// can promote by email:
//
//   npx tsx scripts/make-admin.ts you@example.com
//
// The user must have signed in at least once — the profile row is created on
// their first authenticated request.
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "@neondatabase/serverless";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npx tsx scripts/make-admin.ts <email>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set — add it to .env.local first.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(
      `update profiles
          set role = 'admin'
        where lower(email) = $1
        returning id, email, role`,
      [email],
    );

    if (rows.length === 0) {
      console.error(
        `No profile found for ${email}. Have them sign in once, then run this again.`,
      );
      process.exit(1);
    }

    console.log(`${rows[0].email} is now an admin (user id ${rows[0].id}).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
