import Link from "next/link";
import { redirect } from "next/navigation";
import { InvoiceStatusPill } from "@/components/invoices/ui";
import { getCompany } from "@/lib/portal";
import { listInvoices } from "@/lib/invoices/repo";
import { moneyExact, longDate } from "@/lib/demo/format";
import type { Region } from "@/lib/demo/types";

export const metadata = { title: "Invoices — Mizan" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { company } = await getCompany();
  if (!company) redirect("/app/onboarding");
  const { error, ok } = await searchParams;
  const region = company.region as Region;

  const invoices = await listInvoices(company.id);
  const outstanding = invoices
    .filter((i) => i.status === "sent")
    .reduce((sum, i) => sum + i.total, 0);
  const paidThisYear = invoices
    .filter(
      (i) =>
        i.status === "paid" &&
        i.paidAt &&
        new Date(i.paidAt).getFullYear() === new Date().getFullYear(),
    )
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Create, share and track invoices — payments post straight to your books.
          </p>
        </div>
        <Link href="/app/invoices/new" className="btn-primary">
          New invoice
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {ok && (
        <p className="mt-4 rounded-xl border border-evergreen/30 bg-evergreen/5 px-4 py-3 text-sm">
          {ok}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Outstanding</p>
          <p className="tnum mt-2 font-display text-3xl font-semibold">
            {moneyExact(outstanding, region)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">
            Paid in {new Date().getFullYear()}
          </p>
          <p className="tnum mt-2 font-display text-3xl font-semibold">
            {moneyExact(paidThisYear, region)}
          </p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="card mt-8 text-center">
          <p className="font-display text-lg font-medium">No invoices yet</p>
          <p className="mt-2 text-sm text-ink-soft">
            Create your first invoice and share it as a link or PDF — when it&apos;s paid,
            Mizan posts the income to your books automatically.
          </p>
          <Link href="/app/invoices/new" className="btn-primary mt-4 inline-block">
            Create an invoice
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3">
                    <Link href={`/app/invoices/${inv.id}`} className="font-medium text-brass-deep hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{inv.customerName}</td>
                  <td className="tnum px-4 py-3 text-ink-soft">
                    {longDate(inv.issueDate, region)}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusPill status={inv.status} />
                  </td>
                  <td className="tnum px-4 py-3 text-right font-medium">
                    {moneyExact(inv.total, region)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
