import Link from "next/link";
import { Logo } from "@/components/Logo";

export function UkFooter() {
  return (
    <footer className="border-t border-line bg-paper-dim">
      <div className="shell flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-sm text-sm text-ink-soft">
            Bookkeeping and Making Tax Digital software for UK freelancers and
            sole traders. You review and approve; your tax agent files.
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
