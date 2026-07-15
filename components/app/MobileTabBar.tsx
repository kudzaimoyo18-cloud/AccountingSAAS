"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Cash Now flat bottom tab bar (design: MOBILE › bottom tab bar). Five equal
// icon+label tabs, backdrop blur, safe-area padded. Home · Money · Scan ·
// Insights · Profile — every other destination lives in the Profile hub's list
// (the "More" overflow), so the bar stays exactly five tabs.

type Item = { href: string; label: string; icon: string; exact?: boolean; match?: string[] };

const TABS: Item[] = [
  { href: "/app", label: "Home", exact: true, icon: "M2 8.5 8 3l6 5.5M3.5 7.5V13h3v-3h3v3h3V7.5" },
  {
    href: "/app/books/ledger",
    label: "Money",
    icon: "M3 2h8l2 2v10H3zM6 6h5M6 9h5M6 12h3",
    match: ["/app/books", "/app/invoices", "/app/customers", "/app/documents"],
  },
  { href: "/app/capture", label: "Scan", icon: "M2 5.5h2.5L6 3.5h4l1.5 2H14a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zM8 7.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" },
  { href: "/app/reports", label: "Insights", icon: "M3 13V7M8 13V3M13 13v-4" },
  {
    href: "/app/profile",
    label: "Profile",
    icon: "M8 7.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM2.8 13.7c.6-2.8 2.6-4.2 5.2-4.2s4.6 1.4 5.2 4.2",
    match: ["/app/settings", "/app/billing", "/admin"],
  },
];

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (item: Item) => {
    if (item.exact) return pathname === item.href;
    if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
    return (item.match ?? []).some((m) => pathname === m || pathname.startsWith(m + "/"));
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[76px] items-start justify-around border-t border-line bg-surface/95 px-3.5 pt-2.5 backdrop-blur-md md:hidden print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-[3px] transition-colors ${
              active ? "text-evergreen-deep" : "text-ink-soft"
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d={item.icon} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10px] font-bold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
