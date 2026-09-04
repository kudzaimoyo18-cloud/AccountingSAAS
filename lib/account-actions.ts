"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, profiles } from "@/lib/db/schema";
import { user as authUser } from "@/lib/db/auth-schema";
import { requireProfile } from "@/lib/db/tenant";
import { deleteCompanyObjects } from "@/lib/storage";
import { signOut } from "@/lib/actions";

// Permanent account deletion.
//
// Google Play requires an account-deletion path that a user can start from
// inside the app, and a public web page describing it (see app/account-deletion).
// This is that path. It is deliberately unglamorous and irreversible.
//
// What goes, and why it is enough:
//   profiles           — deleted here. Every company the user OWNS references
//                        profiles.id with ON DELETE CASCADE, so the companies go
//                        with it, and every company-scoped table cascades from
//                        the company. That is the whole books dataset.
//   attribution        — nullable created_by / reviewed_by / invited_by columns
//                        are ON DELETE SET NULL (drizzle/0002_deletable.sql), so
//                        rows belonging to OTHER people's companies survive with
//                        the name detached rather than blocking the delete.
//   company_members    — user_id is ON DELETE SET NULL, so an accountant who
//                        deletes their account stops being a member without
//                        destroying their clients' books.
//   R2 objects         — deleted explicitly below. Nothing cascades into object
//                        storage, so receipts and statements would otherwise
//                        outlive the account.
//   user/session/account (Better Auth) — deleted last; sessions and credentials
//                        cascade from user.id.

const CONFIRM_PHRASE = "DELETE";

export async function deleteAccount(formData: FormData) {
  const { user, profile } = await requireProfile();

  // Typed confirmation. A destructive, irreversible action should not be one
  // stray tap on a phone.
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== CONFIRM_PHRASE) {
    redirect("/app/settings?error=Type+DELETE+to+confirm+account+deletion");
  }

  // Companies this user owns outright. Their files have to be removed from R2
  // before the rows disappear, or we lose the ids that name the objects.
  const owned = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.ownerId, profile.id));

  for (const company of owned) {
    try {
      await deleteCompanyObjects(company.id);
    } catch (err) {
      // A storage failure must not strand a half-deleted account. Log it and
      // carry on — the database delete is the part the user is owed, and an
      // orphaned object with no row pointing at it is unreachable anyway.
      console.error("[deleteAccount] storage:", company.id, err instanceof Error ? err.message : err);
    }
  }

  try {
    await db.transaction(async (tx) => {
      // Cascades: profile -> owned companies -> every company-scoped table.
      await tx.delete(profiles).where(eq(profiles.id, profile.id));
      // Cascades: user -> session, account (credentials, linked Google).
      await tx.delete(authUser).where(eq(authUser.id, user.id));
    });
  } catch (err) {
    console.error("[deleteAccount]", err instanceof Error ? err.message : err);
    redirect("/app/settings?error=Could+not+delete+your+account.+Please+contact+support.");
  }

  // Clear the session cookie so the browser is not left holding a token for a
  // user that no longer exists.
  await signOut();
}
