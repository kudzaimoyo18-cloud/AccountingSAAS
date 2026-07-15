import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCompany } from "@/lib/books/repo";
import { loadStatements } from "@/lib/books/statements";
import { createClient } from "@/lib/supabase/server";
import { MobileHome, type MobileTxn } from "@/components/app/mobile/MobileHome";

export const metadata = { title: "Overview — Mizan" };

// Always live — reflect newly approved figures immediately.
export const dynamic = "force-dynamic";

function money(n: number) {
  return n.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function greeting() {
  // UAE product — greet in Gulf time regardless of server region.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dubai" }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type RecentRow = {
  id: string;
  description: string;
  category: string;
  direction: "income" | "expense";
  amount: number;
  currency: string;
  entry_date: string | null;
};

type FlowRow = { entry_date: string | null; direction: "income" | "expense"; amount: number };

/** Last 6 calendar months of in/out totals, oldest first. */
function cashflow(rows: FlowRow[]) {
  const months: { key: string; label: string; inSum: number; outSum: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      inSum: 0,
      outSum: 0,
    });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const r of rows) {
    if (!r.entry_date) continue;
    const m = byKey.get(r.entry_date.slice(0, 7));
    if (!m) continue;
    if (r.direction === "income") m.inSum += Number(r.amount) || 0;
    else m.outSum += Number(r.amount) || 0;
  }
  const max = Math.max(1, ...months.map((m) => Math.max(m.inSum, m.outSum)));
  return { months, max };
}

export default async function OverviewPage() {
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const supabase = await createClient();
  const flowStart = new Date();
  flowStart.setMonth(flowStart.getMonth() - 5);
  const flowStartIso = `${flowStart.getFullYear()}-${String(flowStart.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ pnl, tax, hasData }, { data: ledger }, { count: docCount }, { data: recentRaw }, { data: flowRaw }] =
    await Promise.all([
      loadStatements(company.id),
      supabase.from("ledger_entries").select("status").eq("company_id", company.id),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id),
      supabase
        .from("ledger_entries")
        .select("id, description, category, direction, amount, currency, entry_date")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("ledger_entries")
        .select("entry_date, direction, amount")
        .eq("company_id", company.id)
        .gte("entry_date", flowStartIso),
    ]);

  const rows = (ledger ?? []) as { status: string }[];
  const toReview = rows.filter((l) => l.status !== "approved").length;
  const approved = rows.length - toReview;
  const docs = docCount ?? 0;
  const recent = (recentRaw ?? []) as RecentRow[];
  const { months, max } = cashflow((flowRaw ?? []) as FlowRow[]);
  const hasFlow = months.some((m) => m.inSum > 0 || m.outSum > 0);

  // Month-over-month change in net (income − expense) for the mobile hero delta.
  const netByMonth = months.map((m) => m.inSum - m.outSum);
  const thisNet = netByMonth[netByMonth.length - 1] ?? 0;
  const lastNet = netByMonth[netByMonth.length - 2] ?? 0;
  const deltaPct = hasFlow && lastNet !== 0 ? ((thisNet - lastNet) / Math.abs(lastNet)) * 100 : null;
  const initials = company.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "MZ";

  // Getting-started checklist — shown until every step is done.
  const checklist = [
    { title: "Create your company", body: "Done — your compliance file exists.", href: "/app/settings", cta: "Settings", done: true },
    { title: "Upload your first document", body: "Add an invoice, receipt, or bank statement — Mizan drafts the accounting for you.", href: "/app/documents", cta: "Upload", done: docs > 0 },
    { title: "Draft your first ledger lines", body: "Extract lines from a document with AI, or add one by hand.", href: "/app/books/ledger", cta: "Open ledger", done: rows.length > 0 },
    { title: "Approve your first line", body: "Approving posts it straight into your double-entry books.", href: "/app/books/ledger", cta: "Review & approve", done: approved > 0 },
    { title: "See your reports", body: "P&L, balance sheet, VAT and corporate tax — live from your approved lines.", href: "/app/reports", cta: "View reports", done: hasData },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const onboarding = doneCount < checklist.length;

  return (
    <>
    {/* mobile Home (Cash Now) */}
    <div className="md:hidden">
      <MobileHome
        companyName={company.name}
        initials={initials}
        greeting={greeting()}
        netProfit={hasData ? pnl.netProfit : 0}
        deltaPct={deltaPct}
        currency="AED"
        hasData={hasData}
        recent={recent as MobileTxn[]}
      />
    </div>

    {/* desktop dashboard */}
    <div className="mx-auto hidden max-w-6xl rise md:block">
      {/* greeting header (Cash Now dashboard) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.82rem] font-semibold text-ink-soft">
            {greeting()}, {company.name} 👋
          </p>
          <h1 className="mt-1 text-[1.6rem] font-extrabold tracking-[-0.02em] text-ink">
            Here&apos;s your money today
          </h1>
        </div>
        <Link href="/app/documents" className="btn-primary">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Upload document
        </Link>
      </div>

      {/* KPI grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Money in" value={hasData ? `AED ${money(pnl.totalIncome)}` : "—"} />
        <Kpi label="Money out" value={hasData ? `AED ${money(pnl.totalExpense)}` : "—"} />
        <Kpi
          label="Net profit"
          value={hasData ? `AED ${money(pnl.netProfit)}` : "—"}
          tone={hasData && pnl.netProfit < 0 ? "danger" : "positive"}
        />
        <Kpi label="VAT due (5%)" value={hasData ? `AED ${money(tax.vat.net)}` : "—"} />
      </div>

      {/* activity + right rail */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        {/* recent activity */}
        <div className="panel overflow-hidden">
          <div className="panel-header">
            <p className="panel-title">Recent activity</p>
            <span className="flex items-center gap-3">
              {toReview > 0 && (
                <Link href="/app/reviews" className="badge badge-warning">
                  {toReview} to review
                </Link>
              )}
              <Link href="/app/books/ledger" className="text-[0.82rem] font-bold text-evergreen-deep hover:text-evergreen">
                View ledger →
              </Link>
            </span>
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-ink">No activity yet</p>
              <p className="mx-auto mt-1 max-w-xs text-[0.82rem] text-ink-soft">
                Snap a receipt or upload a bank statement — the AI drafts your first ledger lines.
              </p>
              <Link href="/app/capture" className="btn-primary btn-sm mt-4">
                Snap a receipt
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3.5 px-5 py-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper-dim ${
                      t.direction === "income" ? "text-positive" : "text-ink-soft"
                    }`}
                    aria-hidden
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d={
                          t.direction === "income"
                            ? "M3 11l3.5-3.5 2.5 2L13 5M13 5H9.5M13 5v3.5"
                            : "M3 5l3.5 3.5 2.5-2L13 11M13 11H9.5M13 11V7.5"
                        }
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.85rem] font-bold text-ink">{t.description}</span>
                    <span className="block text-xs text-ink-soft">
                      {t.category}
                      {t.entry_date &&
                        ` · ${new Date(t.entry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                    </span>
                  </span>
                  <span
                    className={`tnum whitespace-nowrap text-[0.85rem] font-bold ${
                      t.direction === "income" ? "text-positive" : "text-ink"
                    }`}
                  >
                    {t.direction === "income" ? "+" : "−"}
                    {money(Number(t.amount))} {t.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* right rail: cashflow + VAT card */}
        <div className="flex flex-col gap-4">
          <div className="panel p-5">
            <p className="panel-title">Cash flow · 6mo</p>
            {hasFlow ? (
              <>
                <div className="mt-4 flex h-[120px] items-end gap-2.5">
                  {months.map((m) => (
                    <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-24 w-full items-end justify-center gap-[3px]">
                        <div
                          className="w-2 rounded-t-[5px] bg-evergreen"
                          style={{ height: `${Math.round((m.inSum / max) * 100)}%` }}
                          title={`In AED ${money(m.inSum)}`}
                        />
                        <div
                          className="w-2 rounded-t-[5px] bg-line-strong"
                          style={{ height: `${Math.round((m.outSum / max) * 100)}%` }}
                          title={`Out AED ${money(m.outSum)}`}
                        />
                      </div>
                      <span className="text-[0.66rem] font-semibold text-ink-soft">{m.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3.5 flex gap-4 text-[0.72rem] text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[3px] bg-evergreen" aria-hidden /> In
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[3px] bg-line-strong" aria-hidden /> Out
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-[0.82rem] text-ink-soft">
                Your monthly in/out chart appears once ledger lines have dates.
              </p>
            )}
          </div>

          {/* navy VAT card */}
          <div className="rounded-3xl bg-sidebar p-5 text-sidebar-fg">
            <p className="text-xs font-semibold text-sidebar-muted">VAT due (5%)</p>
            <p className="tnum mt-2 text-[1.7rem] font-extrabold tracking-tight">
              {hasData ? `AED ${money(tax.vat.net)}` : "AED 0.00"}
            </p>
            <p className="mb-4 mt-1 text-[0.78rem] text-sidebar-muted">
              Live from your approved lines — review before filing.
            </p>
            <Link href="/app/reports" className="btn-primary w-full">
              Review VAT return
            </Link>
          </div>
        </div>
      </div>

      {/* getting started — until every step is done */}
      {onboarding && (
        <div className="panel mt-6">
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
          </div>
        </div>
      )}
    </div>
    </>
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
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink";
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
            done ? "bg-evergreen text-sidebar" : "border border-line-strong text-ink-soft"
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
        <span className="whitespace-nowrap text-[0.82rem] font-semibold text-evergreen-deep">
          {cta} →
        </span>
      )}
    </Link>
  );
}
