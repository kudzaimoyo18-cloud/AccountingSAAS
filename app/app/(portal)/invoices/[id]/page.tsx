import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InvoiceStatusPill } from "@/components/invoices/ui";
import { CopyLinkButton } from "@/components/invoices/CopyLinkButton";
import { getCompany } from "@/lib/portal";
import { getInvoice } from "@/lib/invoices/repo";
import { markSent, markPaid, voidInvoice, deleteInvoice } from "@/lib/invoices/actions";
import { moneyExact, longDate } from "@/lib/demo/format";
import { REGIONS } from "@/lib/demo/regions";
import type { Region } from "@/lib/demo/types";

export const metadata = { title: "Invoice — Mizan" };

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { company } = await getCompany();
  if (!company) redirect("/app/onboarding");
  const { id } = await params;
  const { error, ok } = await searchParams;
  const region = company.region as Region;

  const detail = await getInvoice(company.id, id);
  if (!detail) notFound();
  const { invoice, lines, customer } = detail;

  const cfg = REGIONS[region];
  const sharePath = invoice.shareToken ? `/i/${invoice.shareToken}` : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/invoices" className="text-sm text-ink-soft hover:text-ink">
        ← Invoices
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="page-title text-2xl">{invoice.number}</h1>
          <InvoiceStatusPill status={invoice.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sharePath && invoice.status !== "void" && (
            <>
              <CopyLinkButton path={sharePath} />
              <a href={sharePath} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                Open / print
              </a>
            </>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="alert-banner alert-banner-danger mt-4">
          {error}
        </p>
      )}
      {ok && <p className="alert-banner alert-banner-positive mt-4">{ok}</p>}

      <div className="card mt-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Billed to</p>
            <Link href={`/app/customers/${customer.id}`} className="mt-1 block font-medium text-evergreen-deep hover:underline">
              {customer.name}
            </Link>
            {customer.trn && <p className="text-xs text-ink-soft">TRN {customer.trn}</p>}
            {customer.address && (
              <p className="mt-1 whitespace-pre-line text-xs text-ink-soft">{customer.address}</p>
            )}
          </div>
          <div className="text-right text-sm">
            <p>
              <span className="text-ink-soft">Issued </span>
              <span className="tnum">{longDate(invoice.issueDate, region)}</span>
            </p>
            {invoice.dueDate && (
              <p>
                <span className="text-ink-soft">Due </span>
                <span className="tnum">{longDate(invoice.dueDate, region)}</span>
              </p>
            )}
            {invoice.paidAt && (
              <p className="text-evergreen">
                Paid <span className="tnum">{longDate(invoice.paidAt, region)}</span>
              </p>
            )}
          </div>
        </div>

        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2.5">{line.description}</td>
                <td className="tnum py-2.5 text-right">{line.qty}</td>
                <td className="tnum py-2.5 text-right">{moneyExact(line.unitPrice, region)}</td>
                <td className="tnum py-2.5 text-right">{moneyExact(line.lineNet, region)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 max-w-xs space-y-1.5 border-t border-line pt-3 text-sm">
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
          <div className="flex justify-between font-display text-base font-semibold">
            <span>Total</span>
            <span className="tnum">{moneyExact(invoice.total, region)}</span>
          </div>
        </div>

        {invoice.notes && (
          <p className="mt-4 whitespace-pre-line border-t border-line pt-3 text-xs text-ink-soft">
            {invoice.notes}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {invoice.status === "draft" && (
          <>
            <form action={markSent}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="btn-primary">Mark as sent</button>
            </form>
            <form action={markPaid}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="btn-ghost">Mark as paid</button>
            </form>
            <form action={deleteInvoice}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="btn-ghost text-danger">Delete draft</button>
            </form>
          </>
        )}
        {invoice.status === "sent" && (
          <>
            <form action={markPaid}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="btn-primary">Mark as paid</button>
            </form>
            <form action={voidInvoice}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="btn-ghost text-danger">Void invoice</button>
            </form>
          </>
        )}
        {invoice.status === "paid" && invoice.ledgerEntryId && (
          <Link href="/app/books/ledger" className="btn-ghost text-sm">
            View the posted entry in the Ledger →
          </Link>
        )}
      </div>

      {invoice.status === "draft" && (
        <p className="mt-3 text-xs text-ink-soft">
          Need to change something? Delete the draft and create it again — the next
          invoice number is reserved automatically.
        </p>
      )}
    </div>
  );
}
