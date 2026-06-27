import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// The "AI-native accounting" engine: Claude reads an invoice / receipt / bank
// statement and proposes draft ledger lines. Output is ALWAYS a draft — a human
// reviewer edits and approves it (see lib/ledger-actions.ts). This keeps Mizan
// on the right side of the line: the AI does the bookkeeping, the licensed agent
// signs off.

// A small UAE-flavoured chart of accounts. Kept short so the model picks well;
// reviewers can override to anything via the editable category column.
export const LEDGER_CATEGORIES = [
  "sales_revenue",
  "other_income",
  "cost_of_sales",
  "salaries_wages",
  "rent",
  "utilities",
  "software_subscriptions",
  "professional_fees",
  "marketing",
  "travel",
  "bank_charges",
  "government_fees",
  "office_supplies",
  "equipment",
  "uncategorised",
] as const;

export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];

export type ExtractedEntry = {
  entry_date: string; // "YYYY-MM-DD" or "" if not legible
  description: string;
  counterparty: string;
  category: LedgerCategory;
  direction: "income" | "expense";
  currency: string;
  amount: number; // net, excluding VAT
  vat_amount: number;
  confidence: number; // 0..1
};

export type ExtractionResult = {
  entries: ExtractedEntry[];
  document_summary: string;
};

const SYSTEM = `You are a UAE bookkeeping assistant for free-zone companies. You read a
single financial document (an invoice, receipt, or bank statement) and extract
the accounting lines it contains.

Rules:
- One ledger line per transaction. A bank statement may contain many; an invoice
  is usually one.
- "amount" is the NET value excluding VAT. "vat_amount" is the VAT portion only
  (UAE standard VAT is 5%). If a line is VAT-inclusive, split it. If there is no
  VAT, set vat_amount to 0.
- "direction" is "income" for money the company receives, "expense" for money it
  pays out.
- Use ISO dates (YYYY-MM-DD). If a date is illegible, use "".
- "currency" is the ISO code shown on the document (default "AED").
- Pick the closest "category" from the allowed list; use "uncategorised" if
  genuinely unclear.
- "confidence" reflects how sure you are about that line (0 to 1). Be honest —
  low confidence on smudged or ambiguous figures is expected and useful; a human
  will review every line.
- Never invent figures. If you cannot read a number, set amount to 0 and
  confidence low.`;

// Forced single-tool call = reliable structured output across SDK versions.
const TOOL_NAME = "record_ledger_entries";

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    document_summary: {
      type: "string",
      description: "One sentence describing what this document is.",
    },
    entries: {
      type: "array",
      description: "Every transaction line found in the document.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          entry_date: {
            type: "string",
            description: "ISO date YYYY-MM-DD, or empty string if not legible.",
          },
          description: { type: "string" },
          counterparty: {
            type: "string",
            description: "The other party (vendor or customer). Empty if unknown.",
          },
          category: { type: "string", enum: LEDGER_CATEGORIES as unknown as string[] },
          direction: { type: "string", enum: ["income", "expense"] },
          currency: { type: "string" },
          amount: { type: "number", description: "Net amount, excluding VAT." },
          vat_amount: { type: "number", description: "VAT portion only; 0 if none." },
          confidence: { type: "number", description: "0..1 self-rated confidence." },
        },
        required: [
          "entry_date",
          "description",
          "counterparty",
          "category",
          "direction",
          "currency",
          "amount",
          "vat_amount",
          "confidence",
        ],
      },
    },
  },
  required: ["document_summary", "entries"],
} as const;

type ExtractInput = {
  data: string; // base64, no newlines
  mediaType: string; // e.g. "application/pdf", "image/png"
  fileName: string;
  docKind: string; // invoice | receipt | bank_statement | other
};

export function isExtractable(mediaType: string): boolean {
  return (
    mediaType === "application/pdf" ||
    mediaType === "image/png" ||
    mediaType === "image/jpeg" ||
    mediaType === "image/webp" ||
    mediaType === "image/gif"
  );
}

export async function extractLedgerEntries(input: ExtractInput): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });

  const sourceBlock: Anthropic.ContentBlockParam =
    input.mediaType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: input.data },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: input.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
            data: input.data,
          },
        };

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: SYSTEM,
    tools: [
      {
        name: TOOL_NAME,
        description: "Record the ledger lines extracted from the document.",
        input_schema: INPUT_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          sourceBlock,
          {
            type: "text",
            text: `This document was uploaded as kind "${input.docKind}" (filename: ${input.fileName}). Extract its ledger lines.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!toolUse) throw new Error("Model did not return structured ledger output");

  const result = toolUse.input as ExtractionResult;
  return {
    document_summary: result.document_summary ?? "",
    entries: Array.isArray(result.entries) ? result.entries : [],
  };
}
