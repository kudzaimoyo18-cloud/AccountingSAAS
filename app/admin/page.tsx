import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { StatusBadge } from "@/components/StatusBadge";
import { getProfile } from "@/lib/portal";

export const metadata = { title: "Admin — Mizan" };

export default async function AdminPage() {
  const { supabase, profile } = await getProfile();
  if (profile?.role !== "admin") redirect("/app");

  const { data: companies } = await supabase
    .from("companies")
    .select("*, compliance_items(id, status)")
    .order("created_at", { ascending: false });

  return (
    <PortalShell active="/admin" isAdmin>
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Clients</h1>
        <p className="tnum mt-1 text-sm text-ink-soft">
          {(companies ?? []).length} companies
        </p>

        {(companies ?? []).length === 0 ? (
          <p className="mt-10 text-sm text-ink-soft">No clients yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
            {(companies ?? []).map((c) => {
              const items = (c.compliance_items ?? []) as { status: string }[];
              const open = items.filter((i) => i.status !== "filed").length;
              const overdue = items.some((i) => i.status === "overdue");
              return (
                <li key={c.id}>
                  <Link
                    href={`/admin/${c.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-paper-dim/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {c.free_zone ?? "—"} · {c.plan} ·{" "}
                        <span className="tnum">{open} open</span>
                      </p>
                    </div>
                    <StatusBadge status={overdue ? "overdue" : c.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
