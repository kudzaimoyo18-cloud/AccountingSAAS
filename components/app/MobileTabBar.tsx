"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/actions";

// Floating pill navigation for phones (md:hidden) — a Telegram-style bar that
// hovers above the bottom edge. Each destination is an icon; the active one
// expands to reveal its label (CSS width/opacity transition). "More" opens a
// slide-up sheet with the overflow. Desktop keeps the workstation sidebar.

type Item = { href: string; label: string; icon: string; exact?: boolean };

const TABS: Item[] = [
  { href: "/app", label: "Home", exact: true, icon: "M2 8.5 8 3l6 5.5M3.5 7.5V13h3v-3h3v3h3V7.5" },
  { href: "/app/books", label: "Books", icon: "M3 2h8l2 2v10H3zM6 6h5M6 9h5M6 12h3" },
  { href: "/app/capture", label: "Snap", icon: "M2 5.5h2.5L6 3.5h4l1.5 2H14a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zM8 7.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" },
  { href: "/app/reports", label: "Reports", icon: "M3 13V7M8 13V3M13 13v-4" },
];

const MORE_ITEMS: Item[] = [
  { href: "/app/customers", label: "Customers", icon: "M8 7.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM2.8 13.7c.6-2.8 2.6-4.2 5.2-4.2s4.6 1.4 5.2 4.2" },
  { href: "/app/invoices", label: "Invoices", icon: "M4 2h8v12l-2-1.3L8 14l-2-1.3L4 14zM6.2 5.5h3.6M6.2 8h3.6" },
  { href: "/app/documents", label: "Documents", icon: "M4 2h5l3 3v9H4zM9 2v3h3" },
  { href: "/app/books/import", label: "Import", icon: "M8 2v8M5 7l3 3 3-3M3 13h10" },
  { href: "/app/reviews", label: "Reviews", icon: "M2 8l3.5 3.5L14 3M2 13h12" },
  { href: "/app/books/close", label: "Period close", icon: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM8 4v4l3 2" },
  { href: "/app/reports", label: "Reports", icon: "M3 13V7M8 13V3M13 13v-4" },
  { href: "/app/billing", label: "Billing", icon: "M2 4h12v8H2zM2 7h12" },
  { href: "/app/settings", label: "Settings", icon: "M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5zM8 1v2M8 13v2M15 8h-2M3 8H1M12.95 3.05l-1.4 1.4M4.46 11.54l-1.41 1.41M12.95 12.95l-1.4-1.4M4.46 4.46 3.05 3.05" },
];

function Icon({ d, size = 21 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MobileTabBar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (item: Item) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/");

  const moreActive =
    MORE_ITEMS.some((i) => pathname === i.href || pathname.startsWith(i.href + "/")) ||
    pathname.startsWith("/admin");

  // A pill item: icon always shown; label reveals with a width/opacity
  // transition when active (the Telegram-style expand).
  const pillClasses = (active: boolean) =>
    `flex h-11 items-center rounded-full px-3 transition-colors duration-200 ${
      active ? "bg-evergreen-soft text-evergreen" : "text-ink-soft hover:bg-paper-dim active:bg-paper-dim"
    }`;

  const label = (text: string, active: boolean) => (
    <span
      className={`overflow-hidden whitespace-nowrap text-xs font-semibold transition-all duration-300 ease-out ${
        active ? "ml-2 max-w-[80px] opacity-100" : "ml-0 max-w-0 opacity-0"
      }`}
    >
      {text}
    </span>
  );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-[calc(0.9rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit max-w-[95vw] items-center gap-1 rounded-full border border-line bg-surface/95 p-1.5 shadow-lift backdrop-blur-md md:hidden print:hidden"
      >
        {TABS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={pillClasses(active)}
            >
              <Icon d={item.icon} />
              {label(item.label, active)}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={pillClasses(moreActive)}
        >
          <Icon d="M3 3h3v3H3zM10 3h3v3h-3zM3 10h3v3H3zM10 10h3v3h-3z" />
          {label("More", moreActive)}
        </button>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="More">
          <button
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-lift">
            <div className="flex justify-center pt-2.5">
              <span className="h-1 w-10 rounded-full bg-line-strong" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 pt-3">
              <p className="text-sm font-semibold text-ink">More</p>
              <ThemeToggle />
            </div>
            <div className="grid grid-cols-3 gap-1 px-3 pb-2">
              {MORE_ITEMS.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3.5 text-center text-[0.72rem] font-medium transition-colors ${
                      active ? "bg-evergreen-soft text-evergreen" : "text-ink hover:bg-paper-dim"
                    }`}
                  >
                    <Icon d={item.icon} size={22} />
                    {item.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  prefetch
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3.5 text-center text-[0.72rem] font-medium text-brass-deep hover:bg-paper-dim"
                >
                  <Icon d="M8 1l2 4 4.5.5-3.5 3 1 4.5L8 10.5 4 13l1-4.5-3.5-3L6 5z" size={22} />
                  Admin
                </Link>
              )}
            </div>
            <div className="border-t border-line px-5 py-3">
              <form action={signOut}>
                <button type="submit" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
