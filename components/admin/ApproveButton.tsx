"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { setCompanyStatus } from "@/lib/admin-actions";

// Approving a company activates a tenant — it is the one destructive-ish action
// in the console, and on a phone it sits under a thumb. So it is two-step: the
// first tap arms it, the second commits, and it disarms itself after a few
// seconds or when focus leaves. Targets are 44px, the platform minimum.

function Submit({ companyName }: { companyName: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary min-h-[44px] px-4 text-sm disabled:opacity-60"
    >
      {pending ? "Approving…" : `Confirm — approve ${companyName}`}
    </button>
  );
}

export function ApproveButton({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 5000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="btn-ghost min-h-[44px] px-4 text-sm"
      >
        Approve
      </button>
    );
  }

  return (
    <form action={setCompanyStatus} className="flex items-center gap-2">
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="status" value="active" />
      <input type="hidden" name="next" value="/admin" />
      <Submit companyName={companyName} />
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="min-h-[44px] px-2 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        Cancel
      </button>
    </form>
  );
}
