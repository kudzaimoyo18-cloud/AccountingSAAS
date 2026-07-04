"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/actions";

type Item = { href: string; label: string; icon: string };

// Primary navigation. Books is a hub (Ledger / Import / Close / Documents live
// inside it); Reviews and Reports are promoted to top level; Settings is pinned
// to the bottom.
const PRIMARY: Item[] = [
  { href: "/app", label: "Overview", icon: "M2 8.5 8 3l6 5.5M3.5 7.5V13h3v-3h3v3h3V7.5" },
  { href: "/app/books", label: "Books", icon: "M3 2h8l2 2v10H3zM6 6h5M6 9h5M6 12h3" },
  { href: "/app/reviews", label: "Reviews", icon: "M2 8l3.5 3.5L14 3M2 13h12" },
  { href: "/app/reports", label: "Reports", icon: "M3 13V7M8 13V3M13 13v-4" },
  { href: "/app/assistant", label: "Assistant", icon: "M8 2a5 5 0 0 0-5 5c0 1.6.8 3 2 4v2h6v-2c1.2-1 2-2.4 2-4a5 5 0 0 0-5-5zM6.5 14h3" },
];

const SETTINGS: Item = {
  href: "/app/settings",
  label: "Settings",
  icon: "M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5zM8 1v2M8 13v2M15 8h-2M3 8H1M12.95 3.05l-1.4 1.4M4.46 11.54l-1.41 1.41M12.95 12.95l-1.4-1.4M4.46 4.46 3.05 3.05",
};

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/app"
      ? pathname === "/app"
      : pathname === href || pathname.startsWith(href + "/");
}

function NavLink({
  item,
  active,
  className = "",
}: {
  item: Item;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={item.href}
      prefetch
      className={`sidebar-link ${active ? "sidebar-link-active" : ""} ${className}`}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d={item.icon}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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

  const primary = (
    <>
      {PRIMARY.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}
      {isAdmin && (
        <Link
          href="/admin"
          prefetch
          className={`sidebar-link mt-4 border border-dashed border-brass/40 text-brass-deep ${
            isActive("/admin") ? "sidebar-link-active" : ""
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M8 1l2 4 4.5.5-3.5 3 1 4.5L8 10.5 4 13l1-4.5-3.5-3L6 5z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          Admin
        </Link>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="glass-panel sticky top-0 hidden max-h-screen w-60 shrink-0 flex-col border-r border-line/50 p-5 md:flex print:hidden">
        <Link href="/" aria-label="Mizan home" className="px-2">
          <Logo />
        </Link>
        <nav className="mt-9 flex flex-1 flex-col gap-1" aria-label="Portal">
          {primary}
        </nav>
        <div className="flex flex-col gap-1">
          <NavLink item={SETTINGS} active={isActive(SETTINGS.href)} />
          <div className="mt-3 flex items-center justify-between border-t border-line pt-4">
            <ThemeToggle />
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-ink-soft transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <header className="glass-panel sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/50 px-5 md:hidden print:hidden">
          <Link href="/" aria-label="Mizan home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <button type="submit" className="text-sm text-ink-soft">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <nav
          className="glass-panel sticky top-14 z-30 flex gap-1 overflow-x-auto border-b border-line/50 px-3 py-2 md:hidden print:hidden"
          aria-label="Portal mobile"
        >
          {PRIMARY.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              className="whitespace-nowrap"
            />
          ))}
          <NavLink item={SETTINGS} active={isActive(SETTINGS.href)} className="whitespace-nowrap" />
          {isAdmin && (
            <Link href="/admin" prefetch className="sidebar-link whitespace-nowrap text-brass-deep">
              Admin
            </Link>
          )}
        </nav>
        <main className="p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
