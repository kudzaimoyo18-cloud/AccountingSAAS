import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="shell flex h-16 items-center justify-between">
        <Link href="/" aria-label="Mizan home">
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
        <div className="flex items-center gap-2.5 sm:gap-3">
          <ThemeToggle />
          {/* Always visible — customers sign in from their phones */}
          <Link
            href="/login"
            className="rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[0.82rem] font-semibold text-ink shadow-xs transition-colors hover:bg-paper-dim"
          >
            Sign in
          </Link>
          <a href="/#waitlist" className="btn-primary hidden text-[0.82rem] sm:inline-flex">
            Get early access
          </a>
        </div>
      </div>
    </header>
  );
}
