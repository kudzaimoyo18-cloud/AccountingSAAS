// Server-side data loaders for the portal.
//
// These used to hand callers a live Supabase client alongside the user, so a
// page could run whatever query it liked and rely on RLS to scope it. On Neon
// there is no RLS, so nothing here hands out a database handle: callers get the
// resolved identity and company, and go through the scoped helpers for data.
//
// Everything is wrapped in React cache() so that when the (portal) layout AND
// the page both ask for the user/profile/company in the same request, it
// resolves to a single set of queries instead of repeating them.
import { redirect } from "next/navigation";

import {
  getActiveCompany,
  getProfile as getProfileRow,
  getUser,
  requireProfile,
  requireTenant,
} from "@/lib/db/tenant";

export const requireUser = async () => {
  const user = await getUser();
  if (!user) redirect("/handler/sign-in");
  return { user };
};

export const getProfile = async () => {
  const found = await requireProfile();
  return { user: found.user, profile: found.profile };
};

export const getCompany = async () => {
  const found = await requireProfile();
  const tenant = await getActiveCompany();
  return {
    user: found.user,
    profile: found.profile,
    // null when the user has not been through onboarding yet — callers decide
    // whether that is a redirect or an empty state.
    company: tenant?.company ?? null,
  };
};

export { getActiveCompany, getProfileRow, requireTenant };
