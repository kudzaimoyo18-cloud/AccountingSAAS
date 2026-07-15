import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InvoiceStatusPill } from "@/components/invoices/ui";
import { getCompany } from "@/lib/portal";
import { updateCustomer, setCustomerArchived } from "@/lib/customers/actions";
import { moneyExact, longDate } from "@/lib/demo/format";
import type { Region } from "@/lib/demo/types";

export const metadata = { title: "Customer — Mizan" };

interface InvoiceRow {
  id: string;
  number: string;
  issue_date: string;
  due_date: string | null;
  status: string;
  total: number | string;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { supabase, company } = await getCompany();
  if (!company) redirect("/app/onboarding");
  const { id } = await params;
  const { error, ok } = await searchParams;
  const region = company.region as Region;

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!customer) notFound();

  const { data: invoiceData } = await supabase
    .from("invoices")
    .select("id, number, issue_date, due_date, status, total")
    .eq("company_id", company.id)
    .eq("customer_id", id)
    .order("issue_date", { ascending: false });
  const invoices = (invoiceData ?? []) as InvoiceRow[];

  const num = (v: number | string) => (typeof v === "number" ? v : parseFloat(v) || 0);
  const outstanding = invoices
    .filter((i) => i.status === "sent")
    .reduce((sum, i) => sum + num(i.total), 0);
  const lifetime = invoices
    .filter((i) => i.status === "sent" || i.status === "paid")
    .reduce((sum, i) => sum + num(i.total), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/customers" className="text-sm text-ink-soft hover:text-ink">
        ← Customers
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title text-2xl">{customer.name}</h1>
        <form action={setCustomerArchived}>
          <input type="hidden" name="id" value={customer.id} />
          <input type="hidden" name="archived" value={customer.archived ? "false" : "true"} />
          <button type="submit" className="btn-ghost btn-sm">
            {customer.archived ? "Restore customer" : "Archive customer"}
          </button>
        </form>
      </div>

      {error && (
        <p role="alert" className="alert-banner alert-banner-danger mt-4">
          {error}
        </p>
      )}
      {ok && <p className="alert-banner alert-banner-positive mt-4">{ok}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Outstanding</p>
          <p className="tnum mt-2 font-display text-3xl font-semibold">
            {moneyExact(outstanding, region)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Lifetime invoiced</p>
          <p className="tnum mt-2 font-display text-3xl font-semibold">
            {moneyExact(lifetime, region)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <form action={updateCustomer} className="card space-y-3 self-start">
          <p className="text-sm font-medium">Details</p>
          <input type="hidden" name="id" value={customer.id} />
          <input name="name" required maxLength={200} defaultValue={customer.name} placeholder="Name *" className="field" aria-label="Name" />
          <input name="email" type="email" maxLength={200} defaultValue={customer.email ?? ""} placeholder="Email" className="field" aria-label="Email" />
          <input name="phone" maxLength={50} defaultValue={customer.phone ?? ""} placeholder="Phone" className="field" aria-label="Phone" />
          <input name="trn" maxLength={50} defaultValue={customer.trn ?? ""} placeholder="TRN / VAT number" className="field" aria-label="TRN or VAT number" />
          <textarea name="address" maxLength={500} defaultValue={customer.address ?? ""} placeholder="Billing address" rows={2} className="field" aria-label="Billing address" />
          <textarea name="notes" maxLength={1000} defaultValue={customer.notes ?? ""} placeholder="Notes (only you see these)" rows={3} className="field" aria-label="Notes" />
          <button type="submit" className="btn-primary w-full">Save changes</button>
        </form>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-medium">Invoices</h2>
            <Link href={`/app/invoices/new?customer=${customer.id}`} className="btn-primary text-sm">
              New invoice
            </Link>
          </div>
          {invoices.length === 0 ? (
            <div className="card mt-4 text-center">
              <p className="text-sm text-ink-soft">No invoices for {customer.name} yet.</p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <Link href={`/app/invoices/${inv.id}`} className="text-sm font-medium text-evergreen-deep hover:underline">
                      {inv.number}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {longDate(inv.issue_date, region)}
                      {inv.due_date && ` · due ${longDate(inv.due_date, region)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-sm font-medium">
                      {moneyExact(num(inv.total), region)}
                    </span>
                    <InvoiceStatusPill status={inv.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
