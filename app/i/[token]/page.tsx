import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/invoices/PrintButton";
import { getInvoiceByToken } from "@/lib/invoices/repo";
import { moneyExact, longDate } from "@/lib/demo/format";
import { REGIONS } from "@/lib/demo/regions";

// Public, tokenised invoice view — doubles as the printable/PDF version.
export const metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getInvoiceByToken(token);
  if (!data) notFound();

  const { invoice, lines, customer, company } = data;
  const region = company.region;
  const cfg = REGIONS[region];

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-ink-soft">
          Invoice from <span className="font-medium text-ink">{company.name}</span>
        </p>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-line bg-surface p-8 shadow-card print:rounded-none print:border-0 print:p-2 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {company.name}
            </h1>
            <p className="mt-1 text-xs text-ink-soft">
              {[
                company.free_zone,
                region === "ae" ? "United Arab Emirates" : "United Kingdom",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {company.trn && <p className="text-xs text-ink-soft">TRN {company.trn}</p>}
          </div>
          <div className="text-right">
            <p className="eyebrow">{invoice.status === "paid" ? "Paid invoice" : "Invoice"}</p>
            <p className="mt-1 font-display text-xl font-semibold">{invoice.number}</p>
            {invoice.status === "paid" && (
              <span className="mt-1 inline-flex items-center rounded-full border border-evergreen/30 bg-evergreen/10 px-2.5 py-0.5 text-xs font-medium text-evergreen">
                Paid{invoice.paidAt ? ` · ${longDate(invoice.paidAt, region)}` : ""}
              </span>
            )}
          </div>
        </header>

        <div className="mt-8 flex flex-wrap justify-between gap-4 border-t border-line pt-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Billed to</p>
            <p className="mt-1 text-sm font-medium">{customer.name}</p>
            {customer.trn && <p className="text-xs text-ink-soft">TRN {customer.trn}</p>}
            {customer.address && (
              <p className="mt-1 whitespace-pre-line text-xs text-ink-soft">{customer.address}</p>
            )}
          </div>
          <div className="text-right text-sm">
            <p>
              <span className="text-ink-soft">Issue date </span>
              <span className="tnum">{longDate(invoice.issueDate, region)}</span>
            </p>
            {invoice.dueDate && (
              <p>
                <span className="text-ink-soft">Due </span>
                <span className="tnum font-medium">{longDate(invoice.dueDate, region)}</span>
              </p>
            )}
            <p>
              <span className="text-ink-soft">Currency </span>
              {invoice.currency}
            </p>
          </div>
        </div>

        <table className="mt-7 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2.5 pr-3">{line.description}</td>
                <td className="tnum py-2.5 text-right">{line.qty}</td>
                <td className="tnum py-2.5 text-right">{moneyExact(line.unitPrice, region)}</td>
                <td className="tnum py-2.5 text-right">{moneyExact(line.lineNet, region)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-5 max-w-xs space-y-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal</span>
            <span className="tnum">{moneyExact(invoice.subtotal, region)}</span>
          </div>
          {invoice.vatAmount > 0 && (
            <div className="flex justify-between text-ink-soft">
              <span>{cfg.vatLabel}</span>
              <span className="tnum">{moneyExact(invoice.vatAmount, region)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 font-display text-lg font-semibold">
            <span>Total due</span>
            <span className="tnum">{moneyExact(invoice.total, region)}</span>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Notes</p>
            <p className="mt-1 whitespace-pre-line text-sm">{invoice.notes}</p>
          </div>
        )}
      </article>

      <footer className="mt-6 text-center text-xs text-ink-soft print:mt-8">
        Issued with{" "}
        <Link href="/" className="font-medium text-brass-deep hover:underline">
          Mizan
        </Link>{" "}
        — effortless books for {region === "ae" ? "UAE" : "UK"} small businesses.
      </footer>
    </main>
  );
}
