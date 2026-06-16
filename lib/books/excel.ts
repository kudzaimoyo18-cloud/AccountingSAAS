import "server-only";

// Filing-ready Excel pack for handoff to a tax agent. Four tabs:
// Summary · Profit & Loss · VAT return · Ledger. Built with exceljs (write-only).

import ExcelJS from "exceljs";
import { REGIONS } from "@/lib/demo/regions";
import type { Region } from "@/lib/demo/types";
import type { Reports } from "./reports";
import type { Txn } from "./types";
import type { BooksCompany } from "./repo";

const BRASS = "FFB8762E";
const INK = "FF1A1A17";

export async function buildWorkbook(
  company: BooksCompany,
  reports: Reports,
  txns: Txn[],
): Promise<Buffer> {
  const cfg = REGIONS[company.region];
  const fmt = moneyFormat(company.region);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mizan";
  wb.created = new Date();

  // ── Summary ──
  const s = wb.addWorksheet("Summary");
  s.columns = [{ width: 32 }, { width: 22 }];
  title(s, `${company.name} — accounts pack`);
  s.addRow([]);
  kv(s, "Jurisdiction", `${cfg.label} · ${cfg.filingAuthority}`);
  kv(s, "Period", periodText(reports, company.region));
  kv(s, "VAT registered", company.vatRegistered ? "Yes" : "No");
  s.addRow([]);
  money2(s, "Revenue", reports.revenue, fmt);
  money2(s, "Total expenses", reports.totalExpenses, fmt);
  money2(s, "Net profit", reports.netProfit, fmt, true);
  s.addRow([]);
  money2(s, `${cfg.vatLabel} due`, reports.vatDue, fmt);
  money2(s, `${cfg.taxName} (set aside)`, reports.withinFreeBand ? 0 : reports.taxSetAside, fmt);
  s.addRow([]);
  kv(s, "Posted transactions", String(reports.postedCount));
  kv(s, "Still in review", String(reports.reviewCount));

  // ── Profit & Loss ──
  const pl = wb.addWorksheet("Profit & Loss");
  pl.columns = [{ header: "Account", width: 30 }, { header: "Code", width: 10 }, { header: "Amount", width: 18 }];
  headerRow(pl);
  sectionRow(pl, "Income");
  for (const l of reports.incomeLines) amountRow(pl, l.name, l.code, l.amount, fmt);
  totalRow(pl, "Total revenue", reports.revenue, fmt);
  sectionRow(pl, "Expenses");
  for (const l of reports.expenseLines) amountRow(pl, l.name, l.code, -l.amount, fmt);
  totalRow(pl, "Total expenses", -reports.totalExpenses, fmt);
  totalRow(pl, "Net profit", reports.netProfit, fmt);

  // ── VAT ──
  const vat = wb.addWorksheet("VAT return");
  vat.columns = [{ header: "Box", width: 34 }, { header: "Amount", width: 18 }];
  headerRow(vat);
  twoCol(vat, "VAT on sales (output)", reports.outputVat, fmt);
  twoCol(vat, "VAT on purchases (input)", -reports.inputVat, fmt);
  twoCol(vat, "Net VAT due", reports.vatDue, fmt, true);

  // ── Ledger ──
  const led = wb.addWorksheet("Ledger");
  led.columns = [
    { header: "Date", width: 12 },
    { header: "Description", width: 34 },
    { header: "Payee", width: 22 },
    { header: "Account", width: 22 },
    { header: "Code", width: 8 },
    { header: "Direction", width: 10 },
    { header: "Net", width: 14 },
    { header: "VAT", width: 12 },
    { header: "Gross", width: 14 },
    { header: "Status", width: 12 },
  ];
  headerRow(led);
  for (const t of [...txns].sort((a, b) => a.date.localeCompare(b.date))) {
    const row = led.addRow([
      t.date,
      t.description,
      t.counterparty ?? "",
      t.category ?? "",
      t.accountCode ?? "",
      t.direction === "in" ? "Money in" : "Money out",
      t.net,
      t.vatAmount,
      t.amount,
      t.status,
    ]);
    [7, 8, 9].forEach((c) => (row.getCell(c).numFmt = fmt));
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── helpers ──

function moneyFormat(region: Region): string {
  const sym = region === "ae" ? '"AED" #,##0.00' : "£#,##0.00";
  return sym;
}

function periodText(reports: Reports, region: Region): string {
  if (!reports.periodStart || !reports.periodEnd) return "—";
  return `${reports.periodStart} to ${reports.periodEnd}`;
}

function title(ws: ExcelJS.Worksheet, text: string) {
  const r = ws.addRow([text]);
  r.font = { size: 16, bold: true, color: { argb: INK } };
}

function kv(ws: ExcelJS.Worksheet, k: string, v: string) {
  const r = ws.addRow([k, v]);
  r.getCell(1).font = { color: { argb: "FF6B6B63" } };
}

function money2(ws: ExcelJS.Worksheet, k: string, v: number, fmt: string, bold = false) {
  const r = ws.addRow([k, v]);
  r.getCell(2).numFmt = fmt;
  if (bold) r.font = { bold: true };
}

function headerRow(ws: ExcelJS.Worksheet) {
  const r = ws.getRow(1);
  r.font = { bold: true, color: { argb: "FFFFFFFF" } };
  r.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
  });
}

function sectionRow(ws: ExcelJS.Worksheet, label: string) {
  const r = ws.addRow([label]);
  r.font = { bold: true, color: { argb: BRASS } };
}

function amountRow(ws: ExcelJS.Worksheet, name: string, code: string, amount: number, fmt: string) {
  const r = ws.addRow([name, code, amount]);
  r.getCell(3).numFmt = fmt;
}

function totalRow(ws: ExcelJS.Worksheet, label: string, amount: number, fmt: string) {
  const r = ws.addRow([label, "", amount]);
  r.font = { bold: true };
  r.getCell(3).numFmt = fmt;
}

function twoCol(ws: ExcelJS.Worksheet, label: string, amount: number, fmt: string, bold = false) {
  const r = ws.addRow([label, amount]);
  r.getCell(2).numFmt = fmt;
  if (bold) r.font = { bold: true };
}
