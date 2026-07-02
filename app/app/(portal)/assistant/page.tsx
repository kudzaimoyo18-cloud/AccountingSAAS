import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany, listTransactions } from "@/lib/books/repo";
import { buildReports } from "@/lib/books/reports";
import { Assistant, type Nudge } from "@/components/app/Assistant";

export const metadata = { title: "Assistant — Mizan" };

export default async function AssistantPage() {
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const supabase = await createClient();
  const txns = await listTransactions(company.id);
  const reports = buildReports(txns, company.region);

  const [{ data: ledger }, { count: newDocs }] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("status, category")
      .eq("company_id", company.id),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .eq("status", "new"),
  ]);

  const ledgerRows = (ledger ?? []) as { status: string; category: string }[];
  const draftLedger = ledgerRows.filter((l) => l.status !== "approved").length;
  const uncategorised = ledgerRows.filter((l) => l.category === "uncategorised").length;

  // Proactive nudges — the "personal assistant keeping an eye on things" part.
  const nudges: Nudge[] = [];
  if (reports.reviewCount > 0)
    nudges.push({
      text: `${reports.reviewCount} transaction${reports.reviewCount === 1 ? "" : "s"} flagged for your review.`,
      href: "/app/reviews",
      cta: "Review",
    });
  if (draftLedger > 0)
    nudges.push({
      text: `${draftLedger} ledger line${draftLedger === 1 ? "" : "s"} still need reviewing or approving.`,
      href: "/app/books/ledger",
      cta: "Open ledger",
    });
  if ((newDocs ?? 0) > 0)
    nudges.push({
      text: `${newDocs} uploaded document${newDocs === 1 ? "" : "s"} ready to turn into ledger lines.`,
      href: "/app/books/ledger",
      cta: "Extract",
    });
  if (uncategorised > 0)
    nudges.push({
      text: `${uncategorised} ledger line${uncategorised === 1 ? "" : "s"} still uncategorised.`,
      href: "/app/books/ledger",
      cta: "Fix",
    });
  if (nudges.length === 0)
    nudges.push({
      text: "Your books are up to date — nothing needs your attention right now.",
      href: "/app/reports",
      cta: "See reports",
    });

  const starters = [
    "What's my VAT position this period?",
    "Anything I need to review?",
    "Explain my net profit.",
    "How much corporate tax should I set aside?",
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Assistant</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Your bookkeeping copilot — it keeps an eye on what needs doing and answers
        questions about {company.name}&apos;s numbers.
      </p>
      <Assistant
        nudges={nudges}
        starters={starters}
        aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
    </div>
  );
}
