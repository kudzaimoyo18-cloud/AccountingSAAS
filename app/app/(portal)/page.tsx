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
    <div className="mx-auto max-w-6xl">
      {/* page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title text-2xl">{company.name}</h1>
            <StatusBadge status={company.status} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {company.freeZone ?? "UAE"} · {company.plan} plan
          </p>
        </div>
        <Link href="/app/documents" className="btn-primary">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Upload document
        </Link>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Net profit" value={hasData ? `AED ${money(pnl.netProfit)}` : "—"} tone={hasData && pnl.netProfit < 0 ? "danger" : "positive"} />
        <Kpi label="VAT due (5%)" value={hasData ? `AED ${money(tax.vat.net)}` : "—"} />
        <Kpi label="To review" value={String(toReview)} tone={toReview > 0 ? "warning" : undefined} />
        <Kpi label="Documents" value={String(docs)} />
      </div>

      {/* getting started panel */}
      <div className="panel mt-8">
        <div className="panel-header">
          <p className="panel-title">Getting started</p>
          <span className="tnum text-[0.8rem] text-ink-soft">
            {doneCount} of {checklist.length} done
          </span>
        </div>
        <div className="h-1 w-full bg-paper-dim" aria-hidden>
          <div
            className="h-full bg-evergreen transition-all"
            style={{ width: `${(doneCount / checklist.length) * 100}%` }}
          />
        </div>
        <div className="divide-y divide-line">
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
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "danger" | "warning";
}) {
  const toneClass =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "positive" ? "text-evergreen" : "text-ink";
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className={`kpi-value ${toneClass}`}>{value}</p>
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
      className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-paper-dim/60"
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] ${
            done ? "bg-evergreen text-white" : "border border-line-strong text-ink-soft"
          }`}
          aria-hidden
        >
          {done ? "✓" : ""}
        </span>
        <div>
          <p className={`text-sm font-medium ${done ? "text-ink-soft line-through decoration-evergreen/40" : "text-ink"}`}>
            {title}
          </p>
          <p className="mt-0.5 text-[0.82rem] text-ink-soft">{body}</p>
        </div>
      </div>
      {!done && (
        <span className="whitespace-nowrap text-[0.82rem] font-semibold text-evergreen">
          {cta} →
        </span>
      )}
    </Link>
  );
}
