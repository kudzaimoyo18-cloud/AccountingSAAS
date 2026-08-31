import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUser } from "@/lib/db/tenant";
import { getActiveCompany } from "@/lib/books/repo";
import { loadSummary } from "@/lib/books/summary";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Opus is proven in this codebase (lib/ai.ts). Override per-env if you want a
// cheaper model for chat.
const MODEL = process.env.MIZAN_ASSISTANT_MODEL || "claude-opus-4-8";

export async function POST(req: NextRequest): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Auth first — the assistant only ever sees the caller's own data, which
  // getActiveCompany() below pins to their company.
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Graceful degradation: no key → the page's nudges still work, chat explains.
  if (!apiKey) {
    return Response.json({
      reply:
        "AI chat isn't switched on yet — add ANTHROPIC_API_KEY to the Mizan environment to enable it. The suggestions above are live and clickable in the meantime.",
    });
  }

  const company = await getActiveCompany();
  if (!company) {
    return Response.json({ reply: "Finish setting up your company first." });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12);
  if (messages.length === 0) {
    return Response.json({ reply: "Ask me anything about your books." });
  }

  // Compact grounding context from the caller's real double-entry books — the
  // same figures /app/reports shows, so the assistant never contradicts them.
  const { reports: r } = await loadSummary(company);

  const context = [
    `Company: ${company.name} (${company.region.toUpperCase()}, ${company.plan} plan).`,
    `Approved ledger entries (posted): ${r.postedCount}; awaiting review/approval: ${r.reviewCount}.`,
    `Revenue: ${r.revenue}; total expenses: ${r.totalExpenses}; net profit: ${r.netProfit}.`,
    `VAT — output: ${r.outputVat}, input: ${r.inputVat}, net due: ${r.vatDue}.`,
    `Estimated tax to set aside: ${r.taxSetAside} (annual projected profit ${r.annualProjectedProfit}).`,
  ].join("\n");

  const system = `You are Mizan's accounting assistant for a UAE small-business owner who does their own books. Be concise, friendly and practical, like a sharp personal assistant. You can explain their figures and walk them through bookkeeping tasks (reviewing flagged lines, importing statements, VAT, corporate tax). When it helps move a task forward, proactively ask ONE clarifying question. Never invent numbers — use only the context below; if a figure isn't there, say so and point them to the right screen (Books, Reviews, Reports, Documents). You are software, not a licensed FTA tax agent — for anything being filed, remind them to have a licensed agent review it.

Current books context:
${context}`;

  const client = new Anthropic({ apiKey });
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const reply = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return Response.json({ reply: reply || "…" });
  } catch (e) {
    console.error("[assistant]", e instanceof Error ? e.message : e);
    return Response.json({
      reply: "Sorry — I hit an error reaching the AI. Please try again in a moment.",
    });
  }
}
