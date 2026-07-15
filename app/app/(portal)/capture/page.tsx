import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany } from "@/lib/books/repo";
import { approveCapturedLine } from "@/lib/books/capture-actions";
import { CaptureUpload } from "@/components/app/CaptureUpload";
import { MobileScanCapture } from "@/components/app/mobile/MobileScanCapture";

export const metadata = { title: "Snap receipt — Mizan" };
export const dynamic = "force-dynamic";
// Photo upload + AI extraction can exceed the platform's default function
// timeout, especially on mobile networks — allow up to 60s.
export const maxDuration = 60;

function money(n: number) {
  return n.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Line = {
  id: string;
  entry_date: string | null;
  description: string;
  counterparty: string | null;
  category: string;
  direction: "income" | "expense";
  currency: string;
  amount: number;
  vat_amount: number;
  confidence: number | null;
  status: string;
};

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; error?: string; warn?: string }>;
}) {
  const company = await getActiveCompany();
  if (!company) redirect("/app/onboarding");

  const { doc, error, warn } = await searchParams;
  const supabase = await createClient();

  // Review step: the lines the AI drafted from this photo (RLS scopes to owner).
  // Plus recent captures for the mobile Scan screen (lines that came from a
  // photo — document_id set).
  const [linesRes, recentRes] = await Promise.all([
    doc
      ? supabase
          .from("ledger_entries")
          .select(
            "id, entry_date, description, counterparty, category, direction, currency, amount, vat_amount, confidence, status",
          )
          .eq("company_id", company.id)
          .eq("document_id", doc)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as Line[] }),
    supabase
      .from("ledger_entries")
      .select("id, description, category, direction, amount, currency, entry_date")
      .eq("company_id", company.id)
      .not("document_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const lines = (linesRes.data as Line[]) ?? [];
  const recentCaptures = (recentRes.data ?? []) as Array<{
    id: string;
    description: string;
    category: string;
    direction: "income" | "expense";
    amount: number;
    currency: string;
    entry_date: string | null;
  }>;

  const pendingLines = lines.filter((l) => l.status !== "approved");
  const approvedLines = lines.filter((l) => l.status === "approved");

  return (
    <>
    {/* mobile Scan (Cash Now) */}
    <div className="md:hidden">
      <h1 className="mb-4 text-[22px] font-extrabold tracking-[-0.02em] text-ink">Snap receipt</h1>

      {error && <p role="alert" className="alert-banner alert-banner-danger mb-4">{error}</p>}
      {warn && <p className="alert-banner alert-banner-warning mb-4">{warn}</p>}

      {pendingLines.length > 0 && (
        <div className="mb-5 rounded-2xl border border-evergreen/30 bg-evergreen-soft p-4">
          <p className="text-sm font-bold text-ink">Just captured — approve to post</p>
          <div className="mt-3 space-y-3">
            {pendingLines.map((l) => (
              <div key={l.id} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{l.description || "Untitled"}</p>
                    <p className="mt-0.5 text-[0.78rem] text-ink-soft">
                      {[l.counterparty, l.entry_date, l.category.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className={`tnum shrink-0 text-sm font-extrabold ${l.direction === "income" ? "text-positive" : "text-ink"}`}>
                    {l.direction === "income" ? "+" : "−"}
                    {l.currency} {money(l.amount)}
                  </p>
                </div>
                <form action={approveCapturedLine} className="mt-3">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="next" value={`/app/capture?doc=${doc}`} />
                  <button type="submit" className="btn-primary w-full">Approve — post to books</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <MobileScanCapture companyId={company.id} />

      <h2 className="mb-2.5 mt-1 text-[14px] font-extrabold text-ink">Recent captures</h2>
      {recentCaptures.length === 0 ? (
        <p className="text-[0.82rem] text-ink-soft">Your snapped receipts will appear here.</p>
      ) : (
        <ul>
          {recentCaptures.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-line py-[11px]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-line bg-surface text-ink-soft">
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 2h6l3 3v9H4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold text-ink">{c.description || "Receipt"}</span>
                <span className="block text-[11.5px] text-ink-soft">
                  {c.entry_date ? new Date(c.entry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                  {" · "}
                  {c.category.replace(/_/g, " ")}
                </span>
              </span>
              <span className="tnum shrink-0 text-sm font-extrabold text-ink">
                {c.currency} {money(c.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>

    {/* desktop capture */}
    <div className="mx-auto hidden max-w-lg md:block">
      <p className="text-sm text-ink-soft">
        Photograph a receipt or invoice — Mizan drafts the books, you approve.
      </p>

      {error && (
        <p role="alert" className="alert-banner alert-banner-danger mt-4">
          {error}
        </p>
      )}
      {warn && (
        <p className="alert-banner alert-banner-warning mt-4">{warn}</p>
      )}

      <div className="mt-6">
        <CaptureUpload companyId={company.id} />
      </div>

      {lines.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink">
            {pendingLines.length > 0
              ? `Drafted from your photo — approve to post`
              : `All posted to your books ✓`}
          </h2>

          <div className="mt-3 space-y-3">
            {pendingLines.map((l) => (
              <article key={l.id} className="panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {l.description || "Untitled line"}
                    </p>
                    <p className="mt-0.5 text-[0.8rem] text-ink-soft">
                      {[l.counterparty, l.entry_date, l.category.replace(/_/g, " ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`tnum text-base font-semibold ${
                        l.direction === "income" ? "text-evergreen" : "text-ink"
                      }`}
                    >
                      {l.direction === "income" ? "+" : "−"}
                      {l.currency} {money(l.amount)}
                    </p>
                    {l.vat_amount > 0 && (
                      <p className="tnum text-[0.75rem] text-ink-soft">
                        VAT {money(l.vat_amount)}
                      </p>
                    )}
                  </div>
                </div>

                {typeof l.confidence === "number" && (
                  <p className="mt-2 text-[0.75rem] text-ink-soft">
                    AI confidence {Math.round(l.confidence * 100)}%
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <form action={approveCapturedLine} className="flex-1">
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="next" value={`/app/capture?doc=${doc}`} />
                    <button type="submit" className="btn-primary w-full">
                      Approve — post to books
                    </button>
                  </form>
                  <Link
                    href="/app/books/ledger"
                    className="btn-ghost btn-sm shrink-0"
                    title="Edit details in the ledger"
                  >
                    Edit
                  </Link>
                </div>
              </article>
            ))}

            {approvedLines.map((l) => (
              <article
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-evergreen/25 bg-evergreen-soft px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {l.description || "Untitled line"}
                  </p>
                  <p className="text-[0.78rem] text-evergreen">Approved ✓ posted</p>
                </div>
                <p className="tnum shrink-0 text-sm font-semibold text-ink">
                  {l.currency} {money(l.amount)}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <Link href="/app/capture" className="btn-ghost btn-sm">
              Snap another
            </Link>
            <Link
              href="/app/reports"
              className="text-[0.82rem] font-semibold text-evergreen"
            >
              See it in your reports →
            </Link>
          </div>
        </section>
      )}

      <p className="mt-8 text-xs leading-relaxed text-ink-soft">
        Photos are stored privately with your documents. Nothing posts to your
        books until you approve it.
      </p>
    </div>
    </>
  );
}
