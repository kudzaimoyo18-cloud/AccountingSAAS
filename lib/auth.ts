import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db";
import * as authSchema from "@/lib/db/auth-schema";

// Self-hosted Better Auth, running inside this app against the same Neon
// database as the books. Users, sessions and credentials live in our own
// Postgres (the user/session/account/verification tables in auth-schema.ts),
// so there is no external identity service to keep in sync and no beta SDK in
// the login path.
//
// This replaces Supabase Auth. Session cookies are issued and verified here;
// lib/db/tenant.ts reads the session and maps it to a company.
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),

  secret: process.env.BETTER_AUTH_SECRET,
  // Left undefined in development so Better Auth infers the origin from the
  // request — the dev server does not always land on port 3000, and a hardcoded
  // baseURL makes it reject its own sign-in requests as a foreign origin.
  // In production this must be set to the real site URL.
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),

  emailAndPassword: {
    enabled: true,
    // No mail provider is wired up yet, so requiring verification would lock
    // every new signup out of their own account. Turn this on together with
    // sendVerificationEmail once transactional email exists.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  user: {
    // Our own `profiles` row is created lazily on first authenticated request
    // (see lib/db/tenant.ts), which keeps app data out of the auth tables.
    modelName: "user",
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
    cookieCache: {
      // Avoid a database round trip for the session on every server render.
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  advanced: {
    // The books are a same-site app; there is no cross-site embedding.
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  },

  // Must stay last: lets server actions set the session cookie.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
