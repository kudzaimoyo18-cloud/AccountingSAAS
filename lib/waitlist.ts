import "server-only";

// Waitlist persistence with graceful degradation.
// Writes to Neon when DATABASE_URL is present, otherwise appends to a local
// JSON file so the marketing site still collects signups on a bare checkout.

import { promises as fs } from "fs";
import path from "path";

export type Region = "ae" | "gb";

export type WaitlistEntry = {
  email: string;
  company?: string;
  stage?: string;
  region?: Region;
  created_at: string;
};

const LOCAL_FILE = path.join(process.cwd(), "data", "waitlist.json");

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

async function saveNeon(entry: WaitlistEntry): Promise<void> {
  // Imported lazily so the local-file fallback needs no database driver at all.
  const { db } = await import("@/lib/db");
  const { waitlist } = await import("@/lib/db/schema");

  await db.insert(waitlist).values({
    email: entry.email,
    company: entry.company ?? null,
    stage: entry.stage ?? null,
    region: entry.region ?? "ae",
  });
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
  if (hasDatabase()) {
    await saveNeon(entry);
    return "cloud";
  }
  await saveLocal(entry);
  return "local";
}
