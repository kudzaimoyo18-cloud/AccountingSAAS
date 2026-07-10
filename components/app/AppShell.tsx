"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/actions";

type Item = { href: string; label: string; icon: string; exact?: boolean };
type Group = { label: string; items: Item[] };

// Grouped, workstation-style navigation mapped to real routes only.
const GROUPS: Group[] = [
  {
    label: "Overview",
    items: [
      { href: "/app", label: "Dashboard", icon: "M2 8.5 8 3l6 5.5M3.5 7.5V13h3v-3h3v3h3V7.5", exact: true },
    ],
  },
  {
    label: "Bookkeeping",
    items: [
      { href: "/app/capture", label: "Snap receipt", icon: "M2 5.5h2.5L6 3.5h4l1.5 2H14a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zM8 7.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" },
      { href: "/app/books/ledger", label: "Ledger", icon: "M3 2h8l2 2v10H3zM6 6h5M6 9h5M6 12h3" },
      { href: "/app/documents", label: "Documents", icon: "M4 2h5l3 3v9H4zM9 2v3h3" },
      { href: "/app/books/import", label: "Import", icon: "M8 2v8M5 7l3 3 3-3M3 13h10" },
      { href: "/app/reviews", label: "Reviews", icon: "M2 8l3.5 3.5L14 3M2 13h12" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { href: "/app/reports", label: "Reports", icon: "M3 13V7M8 13V3M13 13v-4" },
      { href: "/app/books/close", label: "Period close", icon: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM8 4v4l3 2" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/app/assistant", label: "Assistant", icon: "M8 2a5 5 0 0 0-5 5c0 1.6.8 3 2 4v2h6v-2c1.2-1 2-2.4 2-4a5 5 0 0 0-5-5zM6.5 14h3" },
    ],
  },
];

const BOTTOM: Item[] = [
  { href: "/app/billing", label: "Billing", icon: "M2 4h12v8H2zM2 7h12" },
  { href: "/app/settings", label: "Settings", icon: "M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5zM8 1v2M8 13v2M15 8h-2M3 8H1M12.95 3.05l-1.4 1.4M4.46 11.54l-1.41 1.41M12.95 12.95l-1.4-1.4M4.46 4.46 3.05 3.05" },
];

const ALL_FLAT: Item[] = [...GROUPS.flatMap((g) => g.items), ...BOTTOM];

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
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const isActive = useIsActive();
  const pathname = usePathname();
  const adminActive = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <div className="flex min-h-screen bg-paper">
      {/* dark workstation sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex print:hidden">
        <Link href="/" aria-label="Mizan home" className="px-2 py-1">
          <Logo onDark />
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
              <Link
                href="/admin"
                prefetch
                className={`sidebar-link ${adminActive ? "sidebar-link-active" : ""}`}
              >
                <NavIcon d="M8 1l2 4 4.5.5-3.5 3 1 4.5L8 10.5 4 13l1-4.5-3.5-3L6 5z" />
                Console
              </Link>
            </div>
          )}
        </nav>

        <div className="mt-2 flex flex-col gap-0.5 border-t border-sidebar-border pt-3">
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
      </aside>

      {/* content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 md:hidden print:hidden">
          <Link href="/" aria-label="Mizan home">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <form action={signOut}>
              <button type="submit" className="text-sm font-medium text-ink-soft">Sign out</button>
            </form>
          </div>
        </header>
        {/* mobile horizontal nav */}
        <nav
          className="sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 md:hidden print:hidden"
          aria-label="Portal mobile"
        >
          {ALL_FLAT.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-current={isActive(item) ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[0.82rem] font-medium transition-colors ${
                isActive(item) ? "bg-evergreen-soft text-evergreen" : "text-ink-soft hover:bg-paper-dim hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
