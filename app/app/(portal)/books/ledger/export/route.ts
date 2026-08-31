import { NextRequest } from "next/server";
import { getActiveCompany } from "@/lib/books/repo";
import { listLedgerEntriesForExport } from "@/lib/books/ledger-query";

// CSV export of the ledger, honouring the same filters as the ledger view so
// "what you see is what you export" — both build their WHERE clause with
// ledgerWhere(), which pins rows to the caller's company.

const COLUMNS = [
  "entry_date",
  "description",
  "counterparty",
  "category",
  "direction",
  "amount",
  "vat_amount",
  "currency",
  "status",
  "source",
  "confidence",
] as const;

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const company = await getActiveCompany();
  if (!company) return new Response("Not found", { status: 404 });

  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const status = params.get("status") ?? "";
  const direction = params.get("direction") ?? "";
  const category = params.get("category") ?? "";

  let rows: Record<string, unknown>[];
  try {
    rows = (await listLedgerEntriesForExport(company.id, {
      q,
      status,
      direction,
      category,
    })) as unknown as Record<string, unknown>[];
  } catch (err) {
    console.error("[books/ledger/export]", err instanceof Error ? err.message : err);
    return new Response("Export failed", { status: 500 });
  }

  const lines = [
    COLUMNS.join(","),
    ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(",")),
  ];

  const safe =
    company.name.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "company";

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}_ledger.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
