"use client";

import { useState } from "react";

interface EditorLine {
  description: string;
  qty: string;
  unitPrice: string;
  vat: boolean; // standard rate on/off
}

const EMPTY: EditorLine = { description: "", qty: "1", unitPrice: "", vat: true };

/**
 * Dynamic invoice line rows with live totals. Serialises the rows into a
 * hidden `lines` input as JSON for the createInvoice server action.
 */
export function LineEditor({
  standardVatRate,
  vatLabel,
  currency,
}: {
  standardVatRate: number;
  vatLabel: string;
  currency: string;
}) {
  const [lines, setLines] = useState<EditorLine[]>([{ ...EMPTY }]);
  const vatEnabled = standardVatRate > 0;

  function update(index: number, patch: Partial<EditorLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  let subtotal = 0;
  let vatTotal = 0;
  for (const line of lines) {
    const qty = parseFloat(line.qty);
    const price = parseFloat(line.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) continue;
    const net = round2(qty * price);
    subtotal = round2(subtotal + net);
    if (vatEnabled && line.vat) vatTotal = round2(vatTotal + round2(net * standardVatRate));
  }
  const total = round2(subtotal + vatTotal);

  const payload = lines
    .filter((l) => l.description.trim() && parseFloat(l.qty) > 0 && parseFloat(l.unitPrice) >= 0)
    .map((l) => ({
      description: l.description.trim(),
      qty: parseFloat(l.qty),
      unitPrice: parseFloat(l.unitPrice),
      vatRate: vatEnabled && l.vat ? standardVatRate : 0,
    }));

  const fmt = (n: number) =>
    n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-3">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-[1fr_4.5rem_7rem_auto_auto] items-center gap-2">
            <input
              value={line.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder={i === 0 ? "What you're charging for *" : "Description"}
              maxLength={300}
              className="field"
              aria-label={`Line ${i + 1} description`}
            />
            <input
              value={line.qty}
              onChange={(e) => update(i, { qty: e.target.value })}
              inputMode="decimal"
              placeholder="Qty"
              className="field tnum text-right"
              aria-label={`Line ${i + 1} quantity`}
            />
            <input
              value={line.unitPrice}
              onChange={(e) => update(i, { unitPrice: e.target.value })}
              inputMode="decimal"
              placeholder={`Price (${currency})`}
              className="field tnum text-right"
              aria-label={`Line ${i + 1} unit price`}
            />
            {vatEnabled ? (
              <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={line.vat}
                  onChange={(e) => update(i, { vat: e.target.checked })}
                  className="h-3.5 w-3.5 accent-brass"
                />
                {vatLabel}
              </label>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => removeLine(i)}
              disabled={lines.length === 1}
              className="text-ink-soft transition-colors hover:text-danger disabled:opacity-30"
              aria-label={`Remove line ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addLine} className="btn-ghost text-sm">
        + Add line
      </button>

      <div className="ml-auto max-w-xs space-y-1.5 border-t border-line pt-3 text-sm">
        <div className="flex justify-between text-ink-soft">
          <span>Subtotal</span>
          <span className="tnum">{fmt(subtotal)} {currency}</span>
        </div>
        {vatEnabled && (
          <div className="flex justify-between text-ink-soft">
            <span>{vatLabel}</span>
            <span className="tnum">{fmt(vatTotal)} {currency}</span>
          </div>
        )}
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span className="tnum">{fmt(total)} {currency}</span>
        </div>
      </div>
    </div>
  );
}
