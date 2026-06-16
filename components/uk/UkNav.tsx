import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/uk#how", label: "How it works" },
  { href: "/uk#pricing", label: "Pricing" },
  { href: "/uk#faq", label: "FAQ" },
];

export function UkNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-md">
      <div className="shell flex h-16 items-center justify-between">
        <Link href="/uk" aria-label="Mizan UK home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a href="/uk#waitlist" className="btn-primary text-[0.82rem]">
            Get early access
          </a>
        </div>
      </div>
    </header>
  );
}
