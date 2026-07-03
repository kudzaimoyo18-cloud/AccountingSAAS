import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCompany } from "@/lib/books/repo";
import { loadStatements } from "@/lib/books/statements";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Overview — Mizan" };

// Always live — reflect newly approved figures immediately.
export const dynamic = "force-dynamic";

function money(n: number) {
  return n.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function OverviewPage() {
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const supabase = await createClient();
  const [{ pnl, tax, hasData }, { data: ledger }, { count: docCount }] =
    await Promise.all([
      loadStatements(company.id),
      supabase.from("ledger_entries").select("status").eq("company_id", company.id),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id),
    ]);

  const toReview = ((ledger ?? []) as { status: string }[]).filter(
    (l) => l.status !== "approved",
  ).length;
  const docs = docCount ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {company.name}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {company.freeZone ?? "UAE"} · {company.plan} plan
          </p>
        </div>
        <StatusBadge status={company.status} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Kpi label="Net profit" value={hasData ? `AED ${money(pnl.netProfit)}` : "—"} />
        <Kpi label="VAT due" value={hasData ? `AED ${money(tax.vat.net)}` : "—"} />
        <Kpi label="To review" value={String(toReview)} />
      </div>

      <h2 className="mt-10 font-display text-xl font-medium">What&apos;s next</h2>
      <div className="mt-4 grid gap-3">
        {docs === 0 && (
          <Step
            href="/app/documents"
            title="Upload your first document"
            body="Add an invoice, receipt, or bank statement — Mizan drafts the accounting for you."
            cta="Upload"
          />
        )}
        {toReview > 0 && (
          <Step
            href="/app/books/ledger"
            title={`Review ${toReview} ledger line${toReview === 1 ? "" : "s"}`}
            body="Check and approve each drafted line. Approving posts it straight to your books."
            cta="Open ledger"
          />
        )}
        <Step
          href="/app/reports"
          title="See your reports"
          body="Profit & loss, balance sheet, VAT and corporate tax — built from your approved lines."
          cta="View reports"
        />
        <Step
          href="/app/assistant"
          title="Ask the assistant"
          body="Questions about your numbers, VAT, or what to do next."
          cta="Open assistant"
        />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className="tnum mt-2 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Step({
  href,
  title,
  body,
  cta,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 transition-colors hover:border-ink/30"
    >
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{body}</p>
      </div>
      <span className="whitespace-nowrap text-sm font-medium text-brass-deep">
        {cta} →
      </span>
    </Link>
  );
}
