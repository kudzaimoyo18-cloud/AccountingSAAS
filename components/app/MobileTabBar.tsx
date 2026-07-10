"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/actions";

// Thumb-reachable bottom navigation for phones (md:hidden — desktop keeps the
// workstation sidebar). Four primary destinations flank a raised center "Snap"
// camera action; everything else lives in a slide-up "More" sheet.

type Item = { href: string; label: string; icon: string; exact?: boolean };

const HOME: Item = { href: "/app", label: "Home", exact: true, icon: "M2 8.5 8 3l6 5.5M3.5 7.5V13h3v-3h3v3h3V7.5" };
const BOOKS: Item = { href: "/app/books", label: "Books", icon: "M3 2h8l2 2v10H3zM6 6h5M6 9h5M6 12h3" };
const REPORTS: Item = { href: "/app/reports", label: "Reports", icon: "M3 13V7M8 13V3M13 13v-4" };

const MORE_ITEMS: Item[] = [
  { href: "/app/documents", label: "Documents", icon: "M4 2h5l3 3v9H4zM9 2v3h3" },
  { href: "/app/books/import", label: "Import", icon: "M8 2v8M5 7l3 3 3-3M3 13h10" },
  { href: "/app/reviews", label: "Reviews", icon: "M2 8l3.5 3.5L14 3M2 13h12" },
  { href: "/app/books/close", label: "Period close", icon: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM8 4v4l3 2" },
  { href: "/app/reports", label: "Reports", icon: "M3 13V7M8 13V3M13 13v-4" },
  { href: "/app/billing", label: "Billing", icon: "M2 4h12v8H2zM2 7h12" },
  { href: "/app/settings", label: "Settings", icon: "M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5zM8 1v2M8 13v2M15 8h-2M3 8H1M12.95 3.05l-1.4 1.4M4.46 11.54l-1.41 1.41M12.95 12.95l-1.4-1.4M4.46 4.46 3.05 3.05" },
];

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
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

  // "More" tab reads active whenever the current route lives inside the sheet.
  const moreActive =
    MORE_ITEMS.some((i) => pathname === i.href || pathname.startsWith(i.href + "/")) ||
    pathname.startsWith("/admin");

  const Tab = ({ item }: { item: Item }) => {
    const active = isActive(item);
    return (
      <Link
        href={item.href}
        prefetch
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.62rem] font-medium transition-colors ${
          active ? "text-evergreen" : "text-ink-soft"
        }`}
      >
        <Icon d={item.icon} />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden"
      >
        <Tab item={HOME} />
        <Tab item={BOOKS} />

        {/* Raised center action — Snap receipt (the hero action). */}
        <div className="relative flex w-[22%] shrink-0 items-start justify-center">
          <Link
            href="/app/capture"
            prefetch
            aria-label="Snap a receipt"
            className={`absolute -top-5 grid h-14 w-14 place-items-center rounded-full border-4 border-paper bg-evergreen text-white shadow-lift transition-transform active:scale-95 ${
              pathname.startsWith("/app/capture") ? "ring-2 ring-evergreen/40" : ""
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 8h2.5L9 5h6l2.5 3H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.3" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </Link>
          <span className="mt-auto pb-1.5 text-[0.62rem] font-medium text-ink-soft">Snap</span>
        </div>

        <Tab item={REPORTS} />

        {/* More opens the overflow sheet. */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.62rem] font-medium transition-colors ${
            moreActive ? "text-evergreen" : "text-ink-soft"
          }`}
        >
          <Icon d="M3 3h3v3H3zM10 3h3v3h-3zM3 10h3v3H3zM10 10h3v3h-3z" />
          More
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
