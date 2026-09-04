"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteAccount } from "@/lib/account-actions";

// In-app account deletion. Google Play requires this path to exist inside the
// app, not only on a support page, and it has to actually delete — see
// lib/account-actions.ts for what goes.
//
// Collapsed by default, then gated on typing DELETE, because it destroys every
// book, invoice and receipt the account owns and cannot be undone.

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="min-h-[44px] w-full rounded-xl bg-danger px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {pending ? "Deleting your account…" : "Delete my account permanently"}
    </button>
  );
}

export function DeleteAccount({ error }: { error?: string }) {
  const [open, setOpen] = useState(Boolean(error));
  const [confirm, setConfirm] = useState("");

  return (
    <div className="card mt-5 border-danger/30">
      <h2 className="font-display text-lg font-medium">Delete account</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Permanently deletes your account, every company you own, and all books,
        invoices, documents and uploaded files. This cannot be undone, and we
        cannot recover it for you afterwards.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-ghost mt-4 min-h-[44px] px-4 text-sm text-danger"
        >
          Delete my account
        </button>
      ) : (
        <form action={deleteAccount} className="mt-4 space-y-3">
          <label htmlFor="confirm" className="block text-sm font-medium">
            Type <span className="font-mono font-bold">DELETE</span> to confirm
          </label>
          <input
            id="confirm"
            name="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            placeholder="DELETE"
            aria-describedby={error ? "delete-error" : undefined}
            className="field min-h-[44px] w-full"
          />
          {error && (
            <p id="delete-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Submit disabled={confirm.trim() !== "DELETE"} />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirm("");
            }}
            className="min-h-[44px] w-full text-sm text-ink-soft transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
