import { NextResponse } from "next/server";
import { saveWaitlist } from "@/lib/storage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = 200;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_LEN) : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = clean(body.email).toLowerCase();
  const company = clean(body.company);
  const stage = clean(body.stage);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 422 }
    );
  }

  try {
    const where = await saveWaitlist({
      email,
      company: company || undefined,
      stage: stage || undefined,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, stored: where });
  } catch (err) {
    console.error("[waitlist] save failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
