// UAE tax computation — pure functions over posted journal lines.
// VAT: output (sales) VAT minus input (purchase) VAT = net payable to the FTA.
// Corporate tax: 9% on taxable profit above AED 375,000 (Federal Decree-Law 47).
// Free-zone "qualifying income" can be 0% — surfaced as a note, not auto-applied.

import { ACC, profitAndLoss, round2, type PostedLine } from "@/lib/accounting";

export const CT_THRESHOLD = 375000;
export const CT_RATE = 0.09;
export const VAT_RATE = 0.05;

export type VatSummary = {
  output: number; // VAT charged on sales (credit balance of VAT Output)
  input: number; // VAT paid on purchases (debit balance of VAT Input)
  net: number; // output - input (positive = payable to FTA, negative = refund)
};

export function computeVat(lines: PostedLine[]): VatSummary {
  let output = 0;
  let input = 0;
  for (const l of lines) {
    if (l.code === ACC.vatOutput) output += Number(l.credit) - Number(l.debit);
    if (l.code === ACC.vatInput) input += Number(l.debit) - Number(l.credit);
  }
  output = round2(output);
  input = round2(input);
  return { output, input, net: round2(output - input) };
}

export type CorporateTax = {
  taxableProfit: number;
  threshold: number;
  taxable: number; // profit above the threshold
  tax: number; // 9% of taxable
};

export function computeCorporateTax(netProfit: number): CorporateTax {
  const taxable = Math.max(0, round2(netProfit - CT_THRESHOLD));
  return {
    taxableProfit: round2(netProfit),
    threshold: CT_THRESHOLD,
    taxable,
    tax: round2(taxable * CT_RATE),
  };
}

export function taxFromLines(lines: PostedLine[]) {
  const vat = computeVat(lines);
  const pnl = profitAndLoss(lines);
  const ct = computeCorporateTax(pnl.netProfit);
  return { vat, ct, netProfit: pnl.netProfit };
}
