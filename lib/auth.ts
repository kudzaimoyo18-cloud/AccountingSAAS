import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// The auth boundary. Everything that used to call supabase.auth.getUser() now
// goes through here. The identity comes from Clerk; the id we store on rows is
// the Clerk user id (a string like "user_...").

export async function currentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  return userId;
}

/**
 * Ensure a profiles row exists for the signed-in Clerk user, and return its id.
 * Replaces Supabase's on_auth_user_created trigger — we upsert lazily on first
 * authenticated request instead.
 */
export async function ensureProfile(): Promise<string> {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/login");

  const claims = (sessionClaims ?? {}) as Record<string, unknown>;
  const name =
    (claims.name as string | undefined) ??
    [claims.given_name, claims.family_name].filter(Boolean).join(" ");
  const fullName = name && name.length > 0 ? name : null;

  await db
    .insert(profiles)
    .values({ id: userId, fullName })
    .onConflictDoNothing({ target: profiles.id });

  return userId;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0]?.role === "admin";
}
