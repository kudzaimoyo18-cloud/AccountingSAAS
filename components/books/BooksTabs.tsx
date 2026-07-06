import Link from "next/link";

export type BooksTab = "overview" | "ledger" | "import" | "close";

const TABS: { key: BooksTab; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/app/books" },
  { key: "ledger", label: "Ledger", href: "/app/books/ledger" },
  { key: "import", label: "Import", href: "/app/books/import" },
  { key: "close", label: "Close & hand off", href: "/app/books/close" },
];

export function BooksTabs({ active }: { active: BooksTab; reviewCount?: number }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-line pb-3" aria-label="Books">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active === tab.key
              ? "bg-evergreen-soft text-evergreen"
              : "text-ink-soft hover:bg-paper-dim hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
