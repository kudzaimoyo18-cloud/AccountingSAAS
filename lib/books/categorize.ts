// Hybrid categorisation orchestrator.
//
// Order of precedence per line:
//   1. Saved vendor rule (learned from a past human correction) → auto-post.
//   2. Deterministic regex rules.
//   3. Claude Haiku pass, only for lines still below the review threshold.
//
// Lines that remain below REVIEW_THRESHOLD after all passes are flagged for
// human review; the rest post automatically.

import { ruleSuggest, normalizeMatch, REVIEW_THRESHOLD } from "./rules";
import { aiCategorizeBatch } from "./ai";
import type { Region } from "@/lib/demo/types";
import type { RawLine, Suggestion } from "./types";

export interface VendorRule {
  matchText: string;
  accountCode: string;
  category: string;
  vatRate: number;
}

export interface CategorizedLine extends RawLine {
  suggestion: Suggestion;
}

export async function categorizeLines(
  lines: RawLine[],
  region: Region,
  standardVatRate: number,
  vendorRules: VendorRule[],
  useAi: boolean,
): Promise<CategorizedLine[]> {
  // Pass 1 — vendor memory + regex rules
  const prelim: CategorizedLine[] = lines.map((line) => {
    const learned = matchVendor(line, vendorRules);
    const suggestion =
      learned ?? ruleSuggest(line.description, line.counterparty, line.direction, region, standardVatRate);
    return { ...line, suggestion };
  });

  // Pass 2 — AI only for the still-uncertain lines
  if (useAi) {
    const uncertain = prelim
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => p.suggestion.confidence < REVIEW_THRESHOLD);

    if (uncertain.length > 0) {
      const aiResults = await aiCategorizeBatch(
        uncertain.map(({ p }) => p),
        region,
        standardVatRate,
      );
      uncertain.forEach(({ index }, k) => {
        const result = aiResults[k];
        if (result) prelim[index] = { ...prelim[index], suggestion: result };
      });
    }
  }

  return prelim;
}

function matchVendor(line: RawLine, rules: VendorRule[]): Suggestion | null {
  if (rules.length === 0) return null;
  const haystack = normalizeMatch(`${line.description} ${line.counterparty}`);
  for (const rule of rules) {
    if (rule.matchText && haystack.includes(rule.matchText)) {
      return {
        accountCode: rule.accountCode,
        category: rule.category,
        vatRate: rule.vatRate,
        confidence: 0.99,
        reason: "matched a saved rule for this vendor",
        source: "rule",
      };
    }
  }
  return null;
}
