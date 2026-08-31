import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/Logo";
import { acceptInvite, requireProfile } from "@/lib/db/tenant";

export const metadata = { title: "Accept invite — Mizan", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Accepting a company invite. Possession of the token is the credential — the
 * link is deliberately not tied to the invited email address, because sign-up
 * requires no email verification and matching on the address would let anyone
 * who registers it claim the invite.
 */
export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Signing in first is required, so the membership binds to a real account.
  const { user } = await requireProfile();
  const { token } = await params;

  const companyId = await acceptInvite(token, user.id);
  if (companyId) redirect("/app");

  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="Mizan home">
            <Logo />
          </Link>
        </div>
        <div className="card">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            This invite is no longer valid
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            It may have already been used, or the company may have revoked it. Ask them to send
            you a fresh invite link.
          </p>
          <Link href="/app" className="btn-ghost mt-6 inline-flex">
            Go to your books
          </Link>
        </div>
      </div>
    </main>
  );
}
