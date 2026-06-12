// Waitlist persistence with graceful degradation.
// Uses Supabase when env is present, otherwise appends to a local JSON file.
// Table expected (see README): public.waitlist (id, email, company, stage, created_at)

import { promises as fs } from "fs";
import path from "path";

export type WaitlistEntry = {
  email: string;
  company?: string;
  stage?: string;
  created_at: string;
};

const LOCAL_FILE = path.join(process.cwd(), "data", "waitlist.json");

function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function saveSupabase(entry: WaitlistEntry): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  );
  const { error } = await client.from("waitlist").insert({
    email: entry.email,
    company: entry.company ?? null,
    stage: entry.stage ?? null,
  });
  if (error) throw new Error(error.message);
}

async function saveLocal(entry: WaitlistEntry): Promise<void> {
  let list: WaitlistEntry[] = [];
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    list = JSON.parse(raw);
  } catch {
    list = [];
  }
  list.push(entry);
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(list, null, 2), "utf8");
}

export async function saveWaitlist(entry: WaitlistEntry): Promise<"cloud" | "local"> {
  if (hasSupabase()) {
    await saveSupabase(entry);
    return "cloud";
  }
  await saveLocal(entry);
  return "local";
}
