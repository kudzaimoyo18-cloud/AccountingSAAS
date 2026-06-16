import "server-only";

// AI categorisation pass. Runs only on lines the rules engine wasn't confident
// about. Uses Claude Haiku 4.5 (cheap, fast classifier). Degrades gracefully:
// with no ANTHROPIC_API_KEY, or on any error, it returns nulls and the caller
// keeps the rule-based suggestion — the product never hard-blocks on the key.

import Anthropic from "@anthropic-ai/sdk";
import { selectableAccounts } from "@/lib/demo/coa";
import type { Region } from "@/lib/demo/types";
import type { RawLine, Suggestion } from "./types";

const MODEL = "claude-haiku-4-5";

interface AiRow {
  i: number;
  accountCode: string;
  vatRate: number;
  confidence: number;
  reason: string;
}

export async function aiCategorizeBatch(
  lines: RawLine[],
  region: Region,
  standardVatRate: number,
): Promise<(Suggestion | null)[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || lines.length === 0) return lines.map(() => null);

  const client = new Anthropic({ apiKey });
  const accounts = selectableAccounts(region);
  const accountList = accounts.map((a) => `${a.code} ${a.name} (${a.type})`).join("\n");

  const system =
    `You are a bookkeeping assistant categorising bank transactions for a ` +
    `${region === "ae" ? "UAE" : "UK"} small business. Assign each line to exactly one ` +
    `account code from the chart of accounts below. Respond ONLY with a JSON array — ` +
    `one object per line, in order: ` +
    `{"i": <line index>, "accountCode": "<code>", "vatRate": <0 or ${standardVatRate}>, ` +
    `"confidence": <0..1>, "reason": "<short why>"}. ` +
    `Use vatRate 0 for salaries, wages, bank/processor fees and anything outside VAT scope; ` +
    `otherwise ${standardVatRate}. Do not include any prose outside the JSON array.`;

  const userLines = lines
    .map((l, i) => `${i}. ${l.direction === "in" ? "IN" : "OUT"} ${l.amount} | ${l.description} | ${l.counterparty}`)
    .join("\n");

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [
        { role: "user", content: `Chart of accounts:\n${accountList}\n\nTransactions:\n${userLines}` },
      ],
    });

    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = JSON.parse(extractJsonArray(text)) as AiRow[];

    return lines.map((_, i) => {
      const hit = parsed.find((p) => p.i === i);
      if (!hit) return null;
      const acct = accounts.find((a) => a.code === hit.accountCode);
      if (!acct) return null;
      const confidence = clamp01(typeof hit.confidence === "number" ? hit.confidence : 0.85);
      return {
        accountCode: acct.code,
        category: acct.name,
        vatRate: hit.vatRate ? standardVatRate : 0,
        confidence,
        reason: hit.reason?.slice(0, 200) || "categorised by Mizan AI",
        source: "ai",
      };
    });
  } catch (error) {
    console.error("[ai categorize]", error instanceof Error ? error.message : error);
    return lines.map(() => null);
  }
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  return start >= 0 && end > start ? text.slice(start, end + 1) : "[]";
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
