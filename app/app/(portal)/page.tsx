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

  const rows = (ledger ?? []) as { status: string }[];
  const toReview = rows.filter((l) => l.status !== "approved").length;
  const approved = rows.length - toReview;
  const docs = docCount ?? 0;

  // Getting-started checklist — each step flips to done from the user's real data.
  const checklist = [
    {
      title: "Create your company",
      body: "Done — your compliance file exists.",
      href: "/app/settings",
      cta: "Settings",
      done: true,
    },
    {
      title: "Upload your first document",
      body: "Add an invoice, receipt, or bank statement — Mizan drafts the accounting for you.",
      href: "/app/documents",
      cta: "Upload",
      done: docs > 0,
    },
    {
      title: "Draft your first ledger lines",
      body: "Extract lines from a document with AI, or add one by hand.",
      href: "/app/books/ledger",
      cta: "Open ledger",
      done: rows.length > 0,
    },
    {
      title: "Approve your first line",
      body: "Approving posts it straight into your double-entry books.",
      href: "/app/books/ledger",
      cta: "Review & approve",
      done: approved > 0,
    },
    {
      title: "See your reports",
      body: "P&L, balance sheet, VAT and corporate tax — live from your approved lines.",
      href: "/app/reports",
      cta: "View reports",
      done: hasData,
    },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

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

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-medium">Getting started</h2>
        <span className="tnum text-sm text-ink-soft">
          {doneCount} of {checklist.length} done
        </span>
      </div>
      {/* progress bar */}
      <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-paper-dim" aria-hidden>
        <div
          className="bg-evergreen transition-all"
          style={{ width: `${(doneCount / checklist.length) * 100}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3">
        {checklist.map((c) => (
          <Step key={c.title} {...c} />
        ))}
        {toReview > 0 && (
          <Step
            href="/app/books/ledger"
            title={`Review ${toReview} pending ledger line${toReview === 1 ? "" : "s"}`}
            body="Lines waiting for your check before they hit the books."
            cta="Review now"
            done={false}
          />
        )}
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
  done,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
  done: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-colors ${
        done
          ? "border-evergreen/25 bg-evergreen/5"
          : "border-line bg-surface hover:border-ink/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] ${
            done ? "bg-evergreen text-paper" : "border border-line text-ink-soft"
          }`}
          aria-hidden
        >
          {done ? "✓" : ""}
        </span>
        <div>
          <p className={`font-medium ${done ? "text-ink-soft line-through decoration-evergreen/40" : ""}`}>
            {title}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">{body}</p>
        </div>
      </div>
      {!done && (
        <span className="whitespace-nowrap text-sm font-medium text-brass-deep">
          {cta} →
        </span>
      )}
    </Link>
  );
}
