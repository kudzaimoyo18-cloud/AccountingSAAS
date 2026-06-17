import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper-dim">
      <div className="shell flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-sm text-sm text-ink-soft">
            Bookkeeping software for UAE and UK small businesses. You review and
            approve; your accountant or tax agent files.
          </p>
        </div>
        <div className="space-y-2 sm:text-right">
          <nav className="flex gap-4 text-sm text-ink-soft sm:justify-end" aria-label="Legal">
            <Link href="/terms" className="transition-colors hover:text-ink">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-ink">Privacy</Link>
          </nav>
          <p className="text-xs text-ink-soft">
            © {new Date().getFullYear()} Mizan.
            <br />
            Software, not tax advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
