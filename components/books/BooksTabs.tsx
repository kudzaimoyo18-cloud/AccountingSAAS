import Link from "next/link";

export type BooksTab = "overview" | "review" | "reports" | "import" | "close";

const TABS: { key: BooksTab; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/app/books" },
  { key: "review", label: "Review", href: "/app/books/review" },
  { key: "reports", label: "Reports", href: "/app/books/reports" },
  { key: "import", label: "Import", href: "/app/books/import" },
  { key: "close", label: "Close & hand off", href: "/app/books/close" },
];

export function BooksTabs({ active, reviewCount = 0 }: { active: BooksTab; reviewCount?: number }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-line pb-3" aria-label="Books">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active === tab.key
              ? "bg-ink text-paper"
              : "text-ink-soft hover:bg-paper-dim hover:text-ink"
          }`}
        >
          {tab.label}
          {tab.key === "review" && reviewCount > 0 && (
            <span
              className={`ml-1.5 inline-grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.65rem] font-semibold ${
                active === "review" ? "bg-paper/20 text-paper" : "bg-brass/15 text-brass-deep"
              }`}
            >
              {reviewCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
