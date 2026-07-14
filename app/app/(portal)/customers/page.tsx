import Link from "next/link";
import { redirect } from "next/navigation";
import { getCompany } from "@/lib/portal";
import { createCustomer } from "@/lib/customers/actions";
import { moneyExact } from "@/lib/demo/format";
import type { Region } from "@/lib/demo/types";

export const metadata = { title: "Customers — Mizan" };

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  archived: boolean;
}

interface InvoiceAgg {
  customer_id: string;
  status: string;
  total: number | string;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { supabase, company } = await getCompany();
  if (!company) redirect("/app/onboarding");
  const { error, ok } = await searchParams;
  const region = company.region as Region;

  const [{ data: customerData }, { data: invoiceData }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, email, phone, archived")
      .eq("company_id", company.id)
      .order("name", { ascending: true }),
    supabase
      .from("invoices")
      .select("customer_id, status, total")
      .eq("company_id", company.id),
  ]);

  const customers = (customerData ?? []) as CustomerRow[];
  const invoiced = new Map<string, number>();
  const outstanding = new Map<string, number>();
  for (const inv of (invoiceData ?? []) as InvoiceAgg[]) {
    const total = typeof inv.total === "number" ? inv.total : parseFloat(inv.total);
    if (!Number.isFinite(total)) continue;
    if (inv.status === "sent" || inv.status === "paid") {
      invoiced.set(inv.customer_id, (invoiced.get(inv.customer_id) ?? 0) + total);
    }
    if (inv.status === "sent") {
      outstanding.set(inv.customer_id, (outstanding.get(inv.customer_id) ?? 0) + total);
    }
  }

  const active = customers.filter((c) => !c.archived);
  const archived = customers.filter((c) => c.archived);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-ink-soft">
        The people and businesses you invoice — contact details, history and balances in
        one place.
      </p>

      {error && (
        <p role="alert" className="alert-banner alert-banner-danger mt-4">
          {error}
        </p>
      )}
      {ok && <p className="alert-banner alert-banner-positive mt-4">{ok}</p>}

      <form action={createCustomer} className="card mt-6 space-y-3">
        <p className="text-sm font-medium">Add a customer</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required maxLength={200} placeholder="Name *" className="field" aria-label="Customer name" />
          <input name="email" type="email" maxLength={200} placeholder="Email" className="field" aria-label="Email" />
          <input name="phone" maxLength={50} placeholder="Phone" className="field" aria-label="Phone" />
          <input name="trn" maxLength={50} placeholder="TRN / VAT number" className="field" aria-label="TRN or VAT number" />
        </div>
        <button type="submit" className="btn-primary">Add customer</button>
      </form>

      {active.length === 0 ? (
        <div className="card mt-6 text-center">
          <p className="font-display text-lg font-medium">No customers yet</p>
          <p className="mt-2 text-sm text-ink-soft">
            Add your first customer above, then send them an invoice from the Invoices tab.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 text-right font-medium">Invoiced</th>
                <th className="px-4 py-3 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {active.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link href={`/app/customers/${c.id}`} className="font-medium text-brass-deep hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="tnum px-4 py-3 text-right">
                    {moneyExact(invoiced.get(c.id) ?? 0, region)}
                  </td>
                  <td className="tnum px-4 py-3 text-right">
                    {(outstanding.get(c.id) ?? 0) > 0 ? (
                      <span className="font-medium text-brass-deep">
                        {moneyExact(outstanding.get(c.id) ?? 0, region)}
                      </span>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-ink-soft hover:text-ink">
            Archived customers ({archived.length})
          </summary>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <Link href={`/app/customers/${c.id}`} className="text-ink-soft hover:text-ink hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
