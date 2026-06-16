"use client";

import Link from "next/link";
import { useStudio } from "./StudioProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FIRM, REGIONS } from "@/lib/demo/regions";
import type { Region } from "@/lib/demo/types";

export type Tab = "overview" | "transactions" | "review" | "reports";

const NAV: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "M2 8.5 8 3l6 5.5M3.5 7.5V13h3v-3h3v3h3V7.5" },
  { key: "transactions", label: "Transactions", icon: "M2 4h12M2 8h12M2 12h12M5 4v8" },
  { key: "review", label: "Review", icon: "M8 1l2 4 4.5.5-3.5 3 1 4.5L8 10.5 4 13l1-4.5-3.5-3L6 5z" },
  { key: "reports", label: "Reports", icon: "M3 13V7m4 6V4m4 9V9m4 4V6" },
];

export function StudioShell({
  active,
  onNavigate,
  children,
}: {
  active: Tab;
  onNavigate: (t: Tab) => void;
  children: React.ReactNode;
}) {
  const { region, setRegion, reports } = useStudio();

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-paper-dim/40 p-5 md:flex">
        <div className="flex items-center gap-3 px-1">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-paper font-display text-sm font-semibold">
            M&amp;
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">{FIRM.name}</p>
            <p className="text-[0.68rem] text-ink-soft">Powered by Mizan</p>
          </div>
        </div>

        <ClientSwitcher region={region} onSwitch={setRegion} />

        <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Studio">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`sidebar-link justify-start ${active === item.key ? "sidebar-link-active" : ""}`}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d={item.icon} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item.label}
              {item.key === "review" && reports.reviewCount > 0 && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-brass/15 px-1.5 text-[0.7rem] font-semibold text-brass-deep">
                  {reports.reviewCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <ThemeToggle />
          <Link href="/" className="text-sm text-ink-soft transition-colors hover:text-ink">
            Exit demo
          </Link>
        </div>
      </aside>

      <div className="flex-1">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-line px-4 md:hidden">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-paper text-xs font-semibold">M&amp;</span>
            <span className="font-display text-sm font-semibold">{FIRM.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/" className="text-sm text-ink-soft">Exit</Link>
          </div>
        </header>
        <div className="border-b border-line px-4 py-2 md:hidden">
          <ClientSwitcher region={region} onSwitch={setRegion} compact />
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden" aria-label="Studio mobile">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`sidebar-link whitespace-nowrap ${active === item.key ? "sidebar-link-active" : ""}`}
            >
              {item.label}
              {item.key === "review" && reports.reviewCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brass/15 px-1 text-[0.65rem] font-semibold text-brass-deep">
                  {reports.reviewCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <main className="p-5 sm:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function ClientSwitcher({
  region,
  onSwitch,
  compact = false,
}: {
  region: Region;
  onSwitch: (r: Region) => void;
  compact?: boolean;
}) {
  const order: Region[] = ["ae", "gb"];
  return (
    <div className={compact ? "" : "mt-6"}>
      {!compact && (
        <p className="px-1 pb-2 text-[0.68rem] font-medium uppercase tracking-wide text-ink-soft">
          Client
        </p>
      )}
      <div className={`flex ${compact ? "gap-2" : "flex-col gap-1.5"}`}>
        {order.map((r) => {
          const c = REGIONS[r];
          const activeClient = region === r;
          return (
            <button
              key={r}
              onClick={() => onSwitch(r)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                activeClient
                  ? "border-brass/50 bg-brass/5"
                  : "border-line hover:border-ink/30 hover:bg-paper-dim/50"
              }`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper-dim text-xs font-semibold text-ink">
                {c.client.handle}
              </span>
              {!compact && (
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-medium">{c.client.name}</span>
                  <span className="block text-[0.68rem] text-ink-soft">
                    {c.flag} {c.label} · {c.client.entity}
                  </span>
                </span>
              )}
              {compact && <span className="text-xs font-medium">{c.flag} {c.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
