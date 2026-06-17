import Link from "next/link";

/**
 * Short, always-visible reminder that keeps Mizan on the "software, you stay in
 * control" side of the line — both for user trust and for legal positioning.
 */
export function ControlNotice({ className = "" }: { className?: string }) {
  return (
    <p
      className={`rounded-xl border border-line bg-paper-dim/60 px-4 py-3 text-xs leading-relaxed text-ink-soft ${className}`}
    >
      <span className="font-medium text-ink">You stay in control.</span> Mizan suggests categories with AI —
      you review and approve before anything is final. It&rsquo;s software, not a licensed accountant or tax
      agent, and doesn&rsquo;t provide tax advice. You&rsquo;re responsible for the accuracy of your books and
      any return you file.{" "}
      <Link href="/terms" className="underline hover:text-ink">Terms</Link>.
    </p>
  );
}
