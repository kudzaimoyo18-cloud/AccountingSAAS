import { Logo } from "@/components/Logo";

export function UkFooter() {
  return (
    <footer className="border-t border-line bg-paper-dim">
      <div className="shell flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-sm text-sm text-ink-soft">
            Bookkeeping, VAT and Making Tax Digital for UK freelancers and sole
            traders. Reviewed and filed by an HMRC-registered agent.
          </p>
        </div>
        <p className="text-xs text-ink-soft">
          © {new Date().getFullYear()} Mizan. Built for UK freelancers.
          <br />
          Not a substitute for formal tax advice.
        </p>
      </div>
    </footer>
  );
}
