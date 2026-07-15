import Link from "next/link";
import { redirect } from "next/navigation";
import { getCompany } from "@/lib/portal";
import { TIERS } from "@/lib/content";
import { signOut } from "@/lib/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = { title: "Profile — Mizan" };
export const dynamic = "force-dynamic";

// Cash Now mobile Profile hub (design: MOBILE › Mobile PROFILE). Avatar, plan
// card, and a settings list that doubles as the "More" overflow — every
// destination that isn't a bottom tab lives here. Reached from the Profile tab.

type Row = { label: string; href: string; icon: string };

const ICON = {
  company: "M3 2h8l2 2v10H3zM6 6h5M6 9h5M6 12h3",
  card: "M2 4h12v8H2zM2 7h12",
  invoices: "M4 2h8v12l-2-1.3L8 14l-2-1.3L4 14zM6.2 5.5h3.6M6.2 8h3.6",
  customers: "M8 7.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM2.8 13.7c.6-2.8 2.6-4.2 5.2-4.2s4.6 1.4 5.2 4.2",
  doc: "M4 2h5l3 3v9H4zM9 2v3h3",
  import: "M8 2v8M5 7l3 3 3-3M3 13h10",
  reviews: "M2 8l3.5 3.5L14 3M2 13h12",
  close: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM8 4v4l3 2",
  assistant: "M8 2a5 5 0 0 0-5 5c0 1.6.8 3 2 4v2h6v-2c1.2-1 2-2.4 2-4a5 5 0 0 0-5-5zM6.5 14h3",
  admin: "M8 1l2 4 4.5.5-3.5 3 1 4.5L8 10.5 4 13l1-4.5-3.5-3L6 5z",
  chevron: "M6 4l4 4-4 4",
};

function ListRow({ row }: { row: Row }) {
  return (
    <Link
      href={row.href}
      prefetch
      className="flex items-center gap-3 border-b border-line px-[18px] py-[15px] last:border-b-0"
    >
      <span className="text-evergreen-deep">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d={row.icon} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="flex-1 text-[14px] font-bold text-ink">{row.label}</span>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="text-ink-soft">
        <path d={ICON.chevron} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

export default async function ProfilePage() {
  const { user, profile, company } = await getCompany();
  if (!company) redirect("/app/onboarding");
  const isAdmin = profile?.role === "admin";

  const initials =
    company.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase() || "MZ";
  const tier = TIERS.find((t) => t.id === company.plan);
  const planLabel = tier ? `${tier.name} · AED ${tier.priceAed}/mo` : `${company.plan ?? "Starter"} plan`;

  const account: Row[] = [
    { label: "Company details", href: "/app/settings", icon: ICON.company },
    { label: "Billing & plan", href: "/app/billing", icon: ICON.card },
    { label: "Assistant", href: "/app/assistant", icon: ICON.assistant },
  ];
  const manage: Row[] = [
    { label: "Invoices", href: "/app/invoices", icon: ICON.invoices },
    { label: "Customers", href: "/app/customers", icon: ICON.customers },
    { label: "Documents", href: "/app/documents", icon: ICON.doc },
    { label: "Import statement", href: "/app/books/import", icon: ICON.import },
    { label: "Reviews", href: "/app/reviews", icon: ICON.reviews },
    { label: "Period close", href: "/app/books/close", icon: ICON.close },
  ];

  return (
    <div className="mx-auto max-w-md rise">
      {/* identity */}
      <div className="mb-6 flex flex-col items-center gap-2.5">
        <span className="grid h-[76px] w-[76px] place-items-center rounded-full bg-evergreen-soft text-2xl font-extrabold text-evergreen-deep">
          {initials}
        </span>
        <span className="text-lg font-extrabold text-ink">{company.name}</span>
        <span className="text-[13px] text-ink-soft">{user.email}</span>
      </div>

      {/* navy plan card */}
      <div className="mb-4 rounded-[22px] bg-sidebar p-5 text-sidebar-fg">
        <p className="text-[12px] text-sidebar-muted">Your plan</p>
        <p className="my-1.5 text-[20px] font-extrabold">{planLabel}</p>
        <Link href="/app/billing" className="btn-primary mt-2 w-full">
          Manage billing
        </Link>
      </div>

      {/* account list */}
      <div className="mb-4 overflow-hidden rounded-[22px] border border-line bg-surface">
        {account.map((r) => (
          <ListRow key={r.href} row={r} />
        ))}
      </div>

      {/* manage / overflow list */}
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">More</p>
      <div className="mb-4 overflow-hidden rounded-[22px] border border-line bg-surface">
        {manage.map((r) => (
          <ListRow key={r.href} row={r} />
        ))}
        {isAdmin && <ListRow row={{ label: "Admin console", href: "/admin", icon: ICON.admin }} />}
      </div>

      {/* appearance + sign out */}
      <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-[18px] py-3">
          <span className="text-[14px] font-bold text-ink">Appearance</span>
          <ThemeToggle />
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-[18px] py-[15px] text-left text-[14px] font-bold text-danger"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M6 2H3v12h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
