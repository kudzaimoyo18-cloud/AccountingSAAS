// Server-side data loaders for the portal. All respect RLS via the user's session.
// Wrapped in React cache() so that when the (portal) layout AND the page both ask
// for the user/profile/company in the same request, it resolves to a single set
// of queries instead of repeating them on every navigation.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

export const getProfile = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();
  return { supabase, user, profile };
});

export const getCompany = cache(async () => {
  const { supabase, user, profile } = await getProfile();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return { supabase, user, profile, company };
});
