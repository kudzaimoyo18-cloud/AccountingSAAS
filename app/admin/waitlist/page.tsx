import { redirect } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { getProfile } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Waitlist — Mizan Admin" };

const FOUNDING_CAP = 50;

export default async function AdminWaitlistPage() {
  const { profile } = await getProfile();
  if (profile?.role !== "admin") redirect("/app");

  // service-role read, gated behind the admin check above
  const admin = createAdminClient();
  const { data: rows, count } = await admin
    .from("waitlist")
    .select("email, company, stage, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  const total = count ?? 0;
  const spotsLeft = Math.max(0, FOUNDING_CAP - total);

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
            href={`mailto:?bcc=${(rows ?? []).map((r) => r.email).join(",")}&subject=Your Mizan founding spot is ready`}
            className="btn-ghost text-sm"
          >
            Email all (BCC)
          </a>
        </div>

        {/* founding-50 progress */}
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-paper-dim">
          <div
            className="h-full rounded-full bg-brass transition-all"
            style={{ width: `${Math.min(100, (total / FOUNDING_CAP) * 100)}%` }}
          />
        </div>

        {total === 0 ? (
          <p className="mt-10 text-center text-sm text-ink-soft">
            No signups yet. Share the landing page to start filling this.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
            {(rows ?? []).map((r, i) => (
              <li key={r.email + i} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <a href={`mailto:${r.email}`} className="text-sm font-medium hover:text-brass-deep">
                    {r.email}
                  </a>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {r.company || "—"}
                    {r.stage && <span> · {r.stage}</span>}
                  </p>
                </div>
                <span className="tnum text-xs text-ink-soft">
                  {new Date(r.created_at).toLocaleDateString("en-AE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
