"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/actions";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { AssistantFab } from "@/components/app/AssistantFab";

type Item = { href: string; label: string; icon: string; exact?: boolean };
type Group = { label: string; items: Item[] };

// Grouped navigation per the Cash Now design (Overview · Money · Insights),
// mapped to real routes only. Capture lives in the sidebar CTA, not the nav.
const GROUPS: Group[] = [
  {
    label: "Overview",
    items: [
      { href: "/app", label: "Dashboard", icon: "M2 8.5 8 3l6 5.5M3.5 7.5V13h3v-3h3v3h3V7.5", exact: true },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/app/books/ledger", label: "Ledger", icon: "M3 2h8l2 2v10H3zM6 6h5M6 9h5M6 12h3" },
      { href: "/app/invoices", label: "Invoices", icon: "M4 2h8v12l-2-1.3L8 14l-2-1.3L4 14zM6.2 5.5h3.6M6.2 8h3.6" },
      { href: "/app/customers", label: "Customers", icon: "M8 7.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM2.8 13.7c.6-2.8 2.6-4.2 5.2-4.2s4.6 1.4 5.2 4.2" },
      { href: "/app/documents", label: "Documents", icon: "M4 2h5l3 3v9H4zM9 2v3h3" },
      { href: "/app/books/import", label: "Import", icon: "M8 2v8M5 7l3 3 3-3M3 13h10" },
      { href: "/app/reviews", label: "Reviews", icon: "M2 8l3.5 3.5L14 3M2 13h12" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/app/reports", label: "Reports", icon: "M3 13V7M8 13V3M13 13v-4" },
      { href: "/app/books/close", label: "Period close", icon: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM8 4v4l3 2" },
      { href: "/app/assistant", label: "Assistant", icon: "M8 2a5 5 0 0 0-5 5c0 1.6.8 3 2 4v2h6v-2c1.2-1 2-2.4 2-4a5 5 0 0 0-5-5zM6.5 14h3" },
    ],
  },
];

// Admin destinations, shown only to admins. "/admin" is a prefix of
// "/admin/waitlist", so Clients must not light up while Waitlist is open —
// see isAdminItemActive below.
const ADMIN: Item[] = [
  { href: "/admin", label: "Clients", icon: "M8 1l2 4 4.5.5-3.5 3 1 4.5L8 10.5 4 13l1-4.5-3.5-3L6 5z" },
  { href: "/admin/waitlist", label: "Waitlist", icon: "M2 4h12M2 8h12M2 12h8" },
];

const BOTTOM: Item[] = [
  { href: "/app/billing", label: "Billing", icon: "M2 4h12v8H2zM2 7h12" },
  { href: "/app/settings", label: "Settings", icon: "M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5zM8 1v2M8 13v2M15 8h-2M3 8H1M12.95 3.05l-1.4 1.4M4.46 11.54l-1.41 1.41M12.95 12.95l-1.4-1.4M4.46 4.46 3.05 3.05" },
];

// Longest-prefix match: route → top-bar page title.
const TITLES: [string, string][] = [
  ["/app/capture", "Snap receipt"],
  ["/app/books/ledger", "Ledger"],
  ["/app/books/import", "Import statements"],
  ["/app/books/close", "Period close"],
  ["/app/books", "Books"],
  ["/app/documents", "Documents"],
  ["/app/reviews", "Reviews"],
  ["/app/customers", "Customers"],
  ["/app/invoices/new", "New invoice"],
  ["/app/invoices", "Invoices"],
  ["/app/reports", "Reports"],
  ["/app/assistant", "Assistant"],
  ["/app/billing", "Billing"],
  ["/app/settings", "Settings"],
  ["/admin/waitlist", "Waitlist"],
  ["/admin", "Console"],
  ["/app", "Dashboard"],
];

function pageTitle(pathname: string) {
  const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(p + "/"));
  return hit ? hit[1] : "Dashboard";
}

function useIsActive() {
  const pathname = usePathname();
  return (item: Item) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/");
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavLink({ item, active, className = "" }: { item: Item; active: boolean; className?: string }) {
  return (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={`sidebar-link ${active ? "sidebar-link-active" : ""} ${className}`}
    >
      <NavIcon d={item.icon} />
      {item.label}
    </Link>
  );
}

export function AppShell({
  children,
  isAdmin = false,
  companyName,
  userEmail,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
  companyName?: string;
  userEmail?: string;
}) {
  const isActive = useIsActive();
  const pathname = usePathname();
  // Clients covers /admin and every per-client page under it, but not Waitlist.
  const isAdminItemActive = (item: Item) =>
    item.href === "/admin"
      ? pathname === "/admin" ||
        (pathname.startsWith("/admin/") && !pathname.startsWith("/admin/waitlist"))
      : pathname === item.href || pathname.startsWith(item.href + "/");
  const title = pageTitle(pathname);
  const initials = (userEmail ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-paper">
      {/* dark workstation sidebar — Stitch layout, evergreen palette */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex print:hidden">
        {/* logo block: green icon tile + wordmark + tenant subtitle */}
        <Link href="/" aria-label="Mizan home" className="flex items-center gap-3 px-2 py-1">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-evergreen text-sidebar">
            <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
              <path d="M13 3v18M6 21h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M13 6 5 9m8-3 8 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M2.5 9a2.5 2.5 0 0 0 5 0zM18.5 9a2.5 2.5 0 0 0 5 0z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold leading-tight tracking-tight text-sidebar-fg">
              Mizan
            </span>
            <span className="block truncate text-[0.68rem] font-medium uppercase tracking-[0.12em] text-sidebar-muted">
              {companyName ?? "UAE Free Zone"}
            </span>
          </span>
        </Link>

        <nav className="mt-4 flex flex-1 flex-col" aria-label="Portal">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item)} />
                ))}
              </div>
            </div>
          ))}
          {isAdmin && (
            <div>
              <p className="nav-group-label">Admin</p>
              <div className="flex flex-col gap-0.5">
                {ADMIN.map((item) => (
                  <NavLink key={item.href} item={item} active={isAdminItemActive(item)} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* bottom block: Snap-receipt CTA (the hero action, per Cash Now) +
            utility links + user row */}
        <div className="mt-2 flex flex-col border-t border-sidebar-border pt-3">
          <Link href="/app/capture" prefetch className="btn-primary btn-glow w-full" title="Snap a receipt">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 5.5h2.5L6 3.5h4l1.5 2H14a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zM8 7.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Snap receipt
          </Link>

          <div className="mt-3 flex flex-col gap-0.5 border-t border-sidebar-border pt-3">
            {BOTTOM.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item)} />
            ))}
            <div className="mt-2 flex items-center justify-between px-3">
              <ThemeToggle />
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-[0.8rem] font-medium text-sidebar-muted transition-colors hover:text-sidebar-fg"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>

          {/* user row (Cash Now bottom-of-sidebar pattern) */}
          <Link
            href="/app/settings"
            className="mt-3 flex items-center gap-2.5 border-t border-sidebar-border px-2 pt-3 transition-colors hover:text-sidebar-fg"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-[0.7rem] font-extrabold text-evergreen">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.82rem] font-bold text-sidebar-fg">
                {userEmail ?? "Account"}
              </span>
              <span className="block truncate text-[0.7rem] text-sidebar-muted">
                {companyName ?? "Your company"}
              </span>
            </span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-sidebar-muted">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </aside>

      {/* content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* desktop top app bar — page title · sync status · search · actions */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b border-line bg-surface/85 px-6 backdrop-blur-xl md:flex print:hidden">
          <div className="flex min-w-0 items-center gap-4">
            <h1 className="page-title truncate">{title}</h1>
            <span className="h-6 w-px shrink-0 bg-line-strong" aria-hidden />
            <span className="flex shrink-0 items-center gap-2">
              <span className="status-dot" aria-hidden />
              <span className="text-[0.8rem] font-medium text-ink-soft">Books synced</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <form action="/app/books/ledger" method="GET" className="relative" role="search">
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
              >
                <path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM14 14l-3.2-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                name="q"
                placeholder="Search transactions…"
                aria-label="Search transactions"
                className="field field-search w-56 py-2 text-[0.85rem] transition-all focus:w-72"
              />
            </form>
            <Link href="/app/reviews" className="icon-btn" title="Reviews" aria-label="Reviews">
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 2a4 4 0 0 0-4 4v2.5L2.5 11h11L12 8.5V6a4 4 0 0 0-4-4zM6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/app/assistant" className="icon-btn" title="Help & assistant" aria-label="Help and assistant">
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM6 6a2 2 0 0 1 3.9.6c0 1.3-2 1.6-2 2.9M8 12h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/app/settings"
              title={userEmail ?? "Account"}
              aria-label="Account settings"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-evergreen-soft text-[0.72rem] font-extrabold text-evergreen-deep transition-shadow hover:shadow-raised"
            >
              {initials}
            </Link>
          </div>
        </header>

        {/* Mobile has no persistent top bar — each Cash Now screen self-headers
            (design: MOBILE). Bottom padding clears the fixed tab bar. */}
        <main className="flex-1 p-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-8 md:pb-8">
          {children}
        </main>
      </div>

      {/* mobile bottom navigation + floating assistant (desktop only) */}
      <MobileTabBar />
      <AssistantFab />
    </div>
  );
}
