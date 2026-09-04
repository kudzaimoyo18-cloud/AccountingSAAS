"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// In-page navigation between the two admin sections.
//
// The sidebar carries these links too, but the sidebar is desktop-only. Without
// this, Waitlist has no route on a phone at all — you could reach the console
// from the Profile hub and then be stuck on Clients.
const TABS = [
  { href: "/admin", label: "Clients" },
  { href: "/admin/waitlist", label: "Waitlist" },
];

export function AdminTabs() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin" ||
        (pathname.startsWith("/admin/") && !pathname.startsWith("/admin/waitlist"))
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav aria-label="Admin sections" className="flex gap-1.5 md:hidden">
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors ${
              active
                ? "bg-evergreen-soft text-evergreen-deep"
                : "bg-paper-dim text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
