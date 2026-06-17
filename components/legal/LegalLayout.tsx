import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";

export function LegalLayout({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="shell flex items-center justify-between py-5">
          <Link href="/" aria-label="Mizan home">
            <Logo />
          </Link>
          <Link href="/" className="text-sm text-ink-soft transition-colors hover:text-ink">
            ← Back to site
          </Link>
        </div>
      </header>

      <main className="shell max-w-3xl py-14">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft">Last updated {lastUpdated}</p>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft">{intro}</p>

        <div className="mt-6 rounded-xl border border-brass/40 bg-brass/5 px-4 py-3 text-xs leading-relaxed text-ink-soft">
          <span className="font-medium text-brass-deep">Template — for review.</span> This is a starting
          draft, not legal advice. Have a qualified solicitor review and adapt it before you rely on it, and
          replace the <span className="font-medium">[bracketed placeholders]</span> once your company is
          registered.
        </div>

        <div className="mt-10 space-y-9">{children}</div>
      </main>

      <Footer />
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-ink">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}
