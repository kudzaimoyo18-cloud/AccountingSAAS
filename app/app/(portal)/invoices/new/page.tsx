import Link from "next/link";
import { redirect } from "next/navigation";
import { LineEditor } from "@/components/invoices/LineEditor";
import { listCustomersForPicker } from "@/lib/invoices/repo";
import { getCompany } from "@/lib/portal";
import { createInvoice } from "@/lib/invoices/actions";
import { REGIONS } from "@/lib/demo/regions";
import type { Region } from "@/lib/demo/types";

export const metadata = { title: "New invoice — Mizan" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; customer?: string }>;
}) {
  const { company } = await getCompany();
  if (!company) redirect("/app/onboarding");
  const { error, customer: preselect } = await searchParams;

  const customers = await listCustomersForPicker(company.id);

  const cfg = REGIONS[company.region as Region];
  const standardVatRate = company.vatRegistered ? cfg.vatRate : 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/invoices" className="text-sm text-ink-soft hover:text-ink">
        ← Invoices
      </Link>

      {error && (
        <p role="alert" className="alert-banner alert-banner-danger mt-4">
          {error}
        </p>
      )}

      {customers.length === 0 ? (
        <div className="card mt-6 text-center">
          <p className="font-display text-lg font-medium">Add a customer first</p>
          <p className="mt-2 text-sm text-ink-soft">
            Invoices are addressed to a customer — add one and come straight back.
          </p>
          <Link href="/app/customers" className="btn-primary mt-4 inline-block">
            Add a customer
          </Link>
        </div>
      ) : (
        <form action={createInvoice} className="card mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label htmlFor="customer_id" className="text-sm font-medium">Customer</label>
              <select
                id="customer_id"
                name="customer_id"
                required
                className="field mt-1.5"
                defaultValue={preselect && customers.some((c) => c.id === preselect) ? preselect : ""}
              >
                <option value="" disabled>Choose…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="issue_date" className="text-sm font-medium">Issue date</label>
              <input id="issue_date" name="issue_date" type="date" required defaultValue={today} className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="due_date" className="text-sm font-medium">
                Due date <span className="text-ink-soft">(optional)</span>
              </label>
              <input id="due_date" name="due_date" type="date" className="field mt-1.5" />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Lines</p>
            <div className="mt-2">
              <LineEditor
                standardVatRate={standardVatRate}
                vatLabel={cfg.vatLabel}
                currency={cfg.currency}
              />
            </div>
            {!company.vatRegistered && (
              <p className="mt-2 text-xs text-ink-soft">
                Your company is set as not VAT-registered, so no VAT is added. Change this
                in Settings if that&apos;s wrong.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="text-sm font-medium">
              Notes on the invoice <span className="text-ink-soft">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={1000}
              placeholder="Payment terms, bank details, thank-you note…"
              className="field mt-1.5"
            />
          </div>

          <button type="submit" className="btn-primary w-full">Create invoice</button>
          <p className="text-center text-xs text-ink-soft">
            Created as a draft — you review it before sharing.
          </p>
        </form>
      )}
    </div>
  );
}
