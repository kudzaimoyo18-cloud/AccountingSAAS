import { getActiveCompany } from "@/lib/books/repo";
import { loadSummary } from "@/lib/books/summary";
import { buildWorkbook } from "@/lib/books/excel";

// Live-generated Excel accounts pack. RLS scopes the data to whoever is
// authenticated — the owner or an invited tax agent. Figures and ledger detail
// come from the double-entry books (same source as /app/reports).
export async function GET() {
  const company = await getActiveCompany();
  if (!company) return new Response("Not found", { status: 404 });

  const { reports, ledgerTxns } = await loadSummary(company);
  const buffer = await buildWorkbook(company, reports, ledgerTxns);

  const safe = company.name.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "company";
  const filename = `${safe}_accounts_pack.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
