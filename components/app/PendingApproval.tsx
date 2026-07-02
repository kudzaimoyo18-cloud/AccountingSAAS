import { signOut } from "@/lib/actions";
import { Logo } from "@/components/Logo";

// Shown by the portal layout when a company exists but isn't 'active' yet — the
// manual-approval gate. An admin flips the company to 'active' from /admin.
export function PendingApproval({
  companyName,
  email,
}: {
  companyName: string;
  email?: string | null;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <div className="mt-8 max-w-md">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          You&apos;re in — pending approval
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          Thanks for setting up{" "}
          <span className="font-medium text-ink">{companyName}</span>. Mizan is
          invite-only while we onboard founding members, so your account needs a
          quick manual approval. We&apos;ll switch it on shortly
          {email ? (
            <>
              {" "}
              and let <span className="font-medium text-ink">{email}</span> know
            </>
          ) : null}
          .
        </p>
        <form action={signOut} className="mt-6">
          <button type="submit" className="btn-ghost">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
