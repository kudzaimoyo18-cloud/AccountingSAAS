"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { statementImports, transactions, vendorRules } from "@/lib/db/schema";
import { onlyThisCompany, requireWritableTenant } from "@/lib/db/tenant";
import { buildKey, isStorageConfigured, putObject } from "@/lib/storage";
import { getVendorRules } from "./repo";
import { categorizeLines } from "./categorize";
import { splitVat, REVIEW_THRESHOLD, normalizeMatch } from "./rules";
import { parseCsv, toLines, type ColumnMap } from "./csv";
import { accountByCode } from "@/lib/demo/coa";
import { REGIONS } from "@/lib/demo/regions";
import type { CategorizedLine } from "./categorize";
import type { Direction, RawLine } from "./types";

const BOOKS = "/app/books";
const MAX_IMPORT_ROWS = 1000;

function vatRateFor(vatRegistered: boolean, region: "ae" | "gb"): number {
  return vatRegistered ? REGIONS[region].vatRate : 0;
}

/**
 * Build the row payload for one categorised line.
 *
 * Drizzle wants numeric columns as strings so the exact decimal survives the
 * round trip — JS floats would quietly re-round money on the way in.
 */
function toTxnRow(
  companyId: string,
  userId: string,
  line: CategorizedLine,
  importId: string | null,
) {
  const { suggestion } = line;
  const { net, vat } = splitVat(line.amount, suggestion.vatRate);
  const posted = suggestion.confidence >= REVIEW_THRESHOLD;
  return {
    companyId,
    importId,
    txnDate: line.date,
    description: line.description.slice(0, 300),
    counterparty: line.counterparty?.slice(0, 200) || null,
    amount: String(line.amount),
    direction: line.direction,
    accountCode: suggestion.accountCode,
    category: suggestion.category,
    vatRate: String(suggestion.vatRate),
    vatAmount: String(vat),
    netAmount: String(net),
    status: posted ? "posted" : "review",
    confidence: String(suggestion.confidence),
    source: importId ? (suggestion.source === "ai" ? "ai" : "import") : suggestion.source,
    reason: suggestion.reason,
    createdBy: userId,
    postedAt: posted ? new Date() : null,
  };
}

// --------------------------- Manual entry ---------------------------

export async function addTransaction(formData: FormData) {
  const { company, user } = await requireWritableTenant();

  const date = String(formData.get("date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const counterparty = String(formData.get("counterparty") ?? "").trim();
  const direction = String(formData.get("direction") ?? "out") as Direction;
  const amount = Math.abs(parseFloat(String(formData.get("amount") ?? "0")));

  if (!date || !description || !Number.isFinite(amount) || amount <= 0) {
    redirect(`${BOOKS}?error=Enter+a+date,+description+and+amount`);
  }
  if (direction !== "in" && direction !== "out") {
    redirect(`${BOOKS}?error=Invalid+direction`);
  }

  const line: RawLine = { date, description, counterparty, amount, direction };
  const rules = await getVendorRules(company.id);
  const [categorized] = await categorizeLines(
    [line],
    company.region as "ae" | "gb",
    vatRateFor(company.vatRegistered, company.region as "ae" | "gb"),
    rules,
    Boolean(process.env.ANTHROPIC_API_KEY),
  );

  try {
    await db.insert(transactions).values(toTxnRow(company.id, user.id, categorized, null));
  } catch (err) {
    console.error("[addTransaction]", err instanceof Error ? err.message : err);
    redirect(`${BOOKS}?error=Could+not+save+the+transaction`);
  }

  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}?ok=Added`);
}

// --------------------------- CSV import ---------------------------

export async function importStatement(formData: FormData) {
  const { company, user } = await requireWritableTenant();

  const file = formData.get("file") as File | null;
  const mappingRaw = String(formData.get("mapping") ?? "");
  if (!file || file.size === 0) redirect(`${BOOKS}/import?error=Choose+a+CSV+file`);
  if (file.size > 5 * 1024 * 1024) redirect(`${BOOKS}/import?error=File+too+large+(max+5MB)`);

  let mapping: ColumnMap;
  try {
    mapping = JSON.parse(mappingRaw) as ColumnMap;
  } catch {
    redirect(`${BOOKS}/import?error=Invalid+column+mapping`);
  }

  const text = await file.text();
  const { rows } = parseCsv(text);
  const lines = toLines(rows, mapping!).slice(0, MAX_IMPORT_ROWS);
  if (lines.length === 0) {
    redirect(`${BOOKS}/import?error=No+rows+found+-+check+the+column+mapping`);
  }

  // Keep the raw CSV for audit. Best-effort: a storage hiccup must not cost the
  // user an import they already waited for.
  const sourceKey = buildKey(company.id, "statements", file.name);
  let storedPath: string | null = null;
  if (isStorageConfigured()) {
    try {
      await putObject(
        sourceKey,
        company.id,
        Buffer.from(text, "utf8"),
        file.type || "text/csv",
      );
      storedPath = sourceKey;
    } catch (err) {
      console.error("[importStatement] archive:", err instanceof Error ? err.message : err);
    }
  }

  const rules = await getVendorRules(company.id);
  const categorized = await categorizeLines(
    lines,
    company.region as "ae" | "gb",
    vatRateFor(company.vatRegistered, company.region as "ae" | "gb"),
    rules,
    Boolean(process.env.ANTHROPIC_API_KEY),
  );

  const postedCount = categorized.filter((c) => c.suggestion.confidence >= REVIEW_THRESHOLD).length;
  const reviewCount = categorized.length - postedCount;

  try {
    // One transaction: an import batch that records 400 rows but saves none is
    // worse than no import at all.
    await db.transaction(async (tx) => {
      const [imp] = await tx
        .insert(statementImports)
        .values({
          companyId: company.id,
          uploadedBy: user.id,
          sourceName: file.name.slice(0, 200),
          sourcePath: storedPath,
          periodLabel: periodLabel(lines),
          rowCount: categorized.length,
          postedCount,
          reviewCount,
        })
        .returning({ id: statementImports.id });

      if (!imp) throw new Error("Could not record the import batch.");

      await tx
        .insert(transactions)
        .values(categorized.map((line) => toTxnRow(company.id, user.id, line, imp.id)));
    });
  } catch (err) {
    console.error("[importStatement]", err instanceof Error ? err.message : err);
    redirect(`${BOOKS}/import?error=Could+not+save+transactions`);
  }

  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}?imported=${categorized.length}&auto=${postedCount}&review=${reviewCount}`);
}

// --------------------------- Review actions ---------------------------

export async function approveTransaction(formData: FormData) {
  const { company } = await requireWritableTenant();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${BOOKS}/review?error=Missing+transaction`);

  // The company filter is load-bearing. Supabase RLS used to add it invisibly;
  // without it, any signed-in user could post another tenant's transaction just
  // by submitting its id.
  const updated = await db
    .update(transactions)
    .set({ status: "posted", postedAt: new Date() })
    .where(onlyThisCompany(transactions, company.id, eq(transactions.id, id)))
    .returning({ id: transactions.id });

  if (updated.length === 0) {
    redirect(`${BOOKS}/review?error=Could+not+approve`);
  }

  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}/review`);
}

export async function reassignTransaction(formData: FormData) {
  const { company, user } = await requireWritableTenant();

  const id = String(formData.get("id") ?? "");
  const accountCode = String(formData.get("account_code") ?? "");
  if (!id || !accountCode) redirect(`${BOOKS}/review?error=Pick+an+account`);

  const account = accountByCode(company.region as "ae" | "gb", accountCode);
  if (!account) redirect(`${BOOKS}/review?error=Unknown+account`);

  // Load the transaction to recompute VAT against its gross amount.
  const [txn] = await db
    .select({
      amount: transactions.amount,
      vatRate: transactions.vatRate,
      description: transactions.description,
      counterparty: transactions.counterparty,
      direction: transactions.direction,
    })
    .from(transactions)
    .where(onlyThisCompany(transactions, company.id, eq(transactions.id, id)))
    .limit(1);

  if (!txn) redirect(`${BOOKS}/review?error=Transaction+not+found`);

  const gross = Number(txn.amount);
  const vatRate = Number(txn.vatRate);
  const { net, vat } = splitVat(gross, vatRate);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({
          accountCode: account.code,
          category: account.name,
          netAmount: String(net),
          vatAmount: String(vat),
          status: "posted",
          source: "manual",
          postedAt: new Date(),
          reason: "approved by you",
        })
        .where(onlyThisCompany(transactions, company.id, eq(transactions.id, id)));

      // Learn: remember this vendor -> account so the same payee auto-posts
      // next time. Part of the same transaction as the correction it came from.
      const matchText = normalizeMatch(`${txn.description ?? ""} ${txn.counterparty ?? ""}`);
      if (matchText.length >= 3) {
        await tx
          .insert(vendorRules)
          .values({
            companyId: company.id,
            matchText,
            accountCode: account.code,
            category: account.name,
            vatRate: String(vatRate),
            direction: txn.direction,
            createdBy: user.id,
          })
          .onConflictDoUpdate({
            target: [vendorRules.companyId, vendorRules.matchText],
            set: {
              accountCode: account.code,
              category: account.name,
              vatRate: String(vatRate),
              direction: txn.direction,
            },
          });
      }
    });
  } catch (err) {
    console.error("[reassignTransaction]", err instanceof Error ? err.message : err);
    redirect(`${BOOKS}/review?error=Could+not+re-assign`);
  }

  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}/review`);
}

export async function deleteTransaction(formData: FormData) {
  const { company } = await requireWritableTenant();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${BOOKS}?error=Missing+transaction`);

  const deleted = await db
    .delete(transactions)
    .where(onlyThisCompany(transactions, company.id, eq(transactions.id, id)))
    .returning({ id: transactions.id });

  if (deleted.length === 0) {
    redirect(`${BOOKS}?error=Could+not+delete`);
  }

  revalidatePath(BOOKS, "layout");
  redirect(`${BOOKS}?ok=Deleted`);
}

function periodLabel(lines: RawLine[]): string {
  if (lines.length === 0) return "";
  const dates = lines.map((l) => l.date).sort();
  const first = new Date(dates[0]);
  return first.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
