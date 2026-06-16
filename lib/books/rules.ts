// Deterministic first-pass categorisation, reusing the demo's regex rule engine.
// Wraps it to tag every suggestion with source "rule".

import { categorize, splitVat, REVIEW_THRESHOLD } from "@/lib/demo/categorize";
import type { Region } from "@/lib/demo/types";
import type { Direction, Suggestion } from "./types";

export { splitVat, REVIEW_THRESHOLD };

export function ruleSuggest(
  description: string,
  counterparty: string,
  direction: Direction,
  region: Region,
  standardVatRate: number,
): Suggestion {
  const s = categorize(description, counterparty ?? "", direction, region, standardVatRate);
  return { ...s, source: "rule" };
}

/**
 * Normalise a vendor string into a stable match fragment: lowercase, strip
 * digits (account/card numbers) and punctuation. Used both when saving a
 * learned rule and when matching new lines against saved rules.
 */
export function normalizeMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\d{2,}/g, " ")
    .replace(/[^a-z& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
