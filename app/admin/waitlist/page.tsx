import { PortalShell } from "@/components/PortalShell";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/db/tenant";

export const metadata = { title: "Waitlist — Mizan Admin" };

const FOUNDING_CAP = 50;

type Region = "ae" | "gb";

const REGION_META: Record<Region, { label: string; badge: string }> = {
  ae: { label: "UAE", badge: "bg-brass/10 text-brass-deep" },
  gb: { label: "UK", badge: "bg-evergreen/10 text-evergreen" },
};

function asRegion(value: unknown): Region {
  return value === "gb" ? "gb" : "ae";
}

export default async function AdminWaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const filter: "all" | Region =
    sp.region === "ae" || sp.region === "gb" ? sp.region : "all";

  // Deliberately unscoped read, gated behind the admin check above.
  const rows = await db
    .select({
      email: waitlist.email,
      company: waitlist.company,
      stage: waitlist.stage,
      region: waitlist.region,
      created_at: waitlist.createdAt,
    })
    .from(waitlist)
    .orderBy(desc(waitlist.createdAt));
  const counts = {
    all: rows.length,
    ae: rows.filter((r) => asRegion(r.region) === "ae").length,
    gb: rows.filter((r) => asRegion(r.region) === "gb").length,
  };

  const visible =
    filter === "all" ? rows : rows.filter((r) => asRegion(r.region) === filter);

  const total = counts.all;
  const spotsLeft = Math.max(0, FOUNDING_CAP - total);
  const bcc = visible.map((r) => r.email).join(",");
  const emailLabel = filter === "all" ? "all" : REGION_META[filter].label;

  const tabs: { key: "all" | Region; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "ae", label: "UAE", n: counts.ae },
    { key: "gb", label: "UK", n: counts.gb },
  ];

  return (
    <PortalShell active="/admin/waitlist" isAdmin>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Waitlist</h1>
            <p className="tnum mt-1 text-sm text-ink-soft">
              {total} signups · {spotsLeft} founding spots left
            </p>
          </div>
          <a
            href={`mailto:?bcc=${bcc}&subject=Your Mizan founding spot is ready`}
            className="btn-ghost text-sm"
          >
            Email {emailLabel} (BCC)
          </a>
        </div>

        {/* region filter */}
        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((t) => {
            const isActive = filter === t.key;
            const href =
              t.key === "all" ? "/admin/waitlist" : `/admin/waitlist?region=${t.key}`;
            return (
              <a
                key={t.key}
                href={href}
                className={
                  isActive
                    ? "rounded-full border border-brass bg-brass/10 px-3 py-1 text-xs font-medium text-brass-deep"
                    : "rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-soft hover:border-ink hover:text-ink"
                }
              >
                {t.label} · {t.n}
              </a>
            );
          })}
        </div>

        {/* founding-50 progress */}
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-paper-dim">
          <div
            className="h-full rounded-full bg-brass transition-all"
            style={{ width: `${Math.min(100, (total / FOUNDING_CAP) * 100)}%` }}
          />
        </div>

        {visible.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink-soft">
            No signups{filter === "all" ? " yet" : ` in ${emailLabel}`}. Share the
            landing page to start filling this.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
            {visible.map((r, i) => {
              const rm = REGION_META[asRegion(r.region)];
              return (
                <li
                  key={r.email + i}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div className="min-w-0">
                    <a
                      href={`mailto:${r.email}`}
                      className="text-sm font-medium hover:text-brass-deep"
                    >
                      {r.email}
                    </a>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                      <span className={`badge ${rm.badge}`}>{rm.label}</span>
                      <span>
                        {r.company || "—"}
                        {r.stage && <span> · {r.stage}</span>}
                      </span>
                    </p>
                  </div>
                  <span className="tnum text-xs text-ink-soft">
                    {new Date(r.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
