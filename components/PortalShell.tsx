import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { signOut } from "@/lib/actions";

const NAV = [
  { href: "/app", label: "Overview", icon: "M2 8.5 8 3l6 5.5M3.5 7.5V13h3v-3h3v3h3V7.5" },
  { href: "/app/books", label: "Books", icon: "M3 2h8l2 2v10H3zM6 6h5M6 9h5M6 12h3" },
  { href: "/app/documents", label: "Documents", icon: "M4 2h5l3 3v9H4zM9 2v3h3" },
  { href: "/app/billing", label: "Billing", icon: "M2 5h12v8H2zM2 7.5h12M5 11h2" },
  { href: "/app/settings", label: "Settings", icon: "M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5zM8 1v2M8 13v2M15 8h-2M3 8H1M12.95 3.05l-1.4 1.4M4.46 11.54l-1.41 1.41M12.95 12.95l-1.4-1.4M4.46 4.46 3.05 3.05" },
];

export function PortalShell({
  children,
  active,
  isAdmin = false,
}: {
  children: React.ReactNode;
  active: string;
  isAdmin?: boolean;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-paper-dim/40 p-5 md:flex">
        <Link href="/" aria-label="Mizan home" className="px-2">
          <Logo />
        </Link>
        <nav className="mt-9 flex flex-1 flex-col gap-1" aria-label="Portal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${active === item.href ? "sidebar-link-active" : ""}`}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d={item.icon} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link
                href="/admin"
                className={`sidebar-link mt-4 border border-dashed border-brass/40 text-brass-deep ${active === "/admin" ? "sidebar-link-active" : ""}`}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 1l2 4 4.5.5-3.5 3 1 4.5L8 10.5 4 13l1-4.5-3.5-3L6 5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                Clients
              </Link>
              <Link
                href="/admin/waitlist"
                className={`sidebar-link border border-dashed border-brass/40 text-brass-deep ${active === "/admin/waitlist" ? "sidebar-link-active" : ""}`}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Waitlist
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit" className="text-sm text-ink-soft transition-colors hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex h-14 items-center justify-between border-b border-line px-5 md:hidden">
          <Link href="/" aria-label="Mizan home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <button type="submit" className="text-sm text-ink-soft">Sign out</button>
            </form>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden" aria-label="Portal mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link whitespace-nowrap ${active === item.href ? "sidebar-link-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="sidebar-link whitespace-nowrap text-brass-deep">
              Admin
            </Link>
          )}
        </nav>
        <main className="p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
