import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so it does not pick up .env.local on its own.
import { config } from "dotenv";
config({ path: ".env.local" });

export default defineConfig({
  schema: ["./lib/db/schema.ts", "./lib/db/auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Only ever touch the public schema.
  schemaFilter: ["public"],
  verbose: true,
  // Push runs from an agent/CI shell with no TTY, so it must not stop to ask.
  // Every generated statement is reviewed before it runs.
  strict: false,
});
