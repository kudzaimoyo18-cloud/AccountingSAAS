import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper-dim">
      <div className="shell flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-sm text-sm text-ink-soft">
            Accounting, VAT and corporate tax for UAE free-zone companies.
            Reviewed and filed by a licensed FTA tax agent.
          </p>
        </div>
        <p className="text-xs text-ink-soft">
          © {new Date().getFullYear()} Mizan. Built in the UAE.
          <br />
          Not a substitute for formal tax advice.
        </p>
      </div>
    </footer>
  );
}
