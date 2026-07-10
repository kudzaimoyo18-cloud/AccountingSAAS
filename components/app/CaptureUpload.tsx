"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { captureReceipt } from "@/lib/books/capture-actions";

// Camera-first capture: the button opens the phone's own camera (rear lens) via
// the `capture` attribute; picking/taking a photo auto-submits to the server
// action which stores it and runs AI extraction. On desktop the same control
// falls back to a normal file picker.
export function CaptureUpload() {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={captureReceipt}>
      <input
        ref={inputRef}
        type="file"
        name="photo"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.currentTarget.files?.length) formRef.current?.requestSubmit();
        }}
      />
      <CaptureButton onPick={() => inputRef.current?.click()} />
    </form>
  );
}

function CaptureButton({ onPick }: { onPick: () => void }) {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <div className="panel flex flex-col items-center gap-4 px-6 py-12 text-center">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 animate-ping rounded-full bg-evergreen/20" />
          <div className="relative grid h-14 w-14 place-items-center rounded-full bg-evergreen-soft">
            <CameraIcon className="h-6 w-6 text-evergreen" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Reading your receipt…</p>
          <p className="mt-1 text-[0.82rem] text-ink-soft">
            Uploading and drafting the ledger line. This takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className="panel flex w-full flex-col items-center gap-4 px-6 py-12 text-center transition-colors hover:border-evergreen/50 active:bg-paper-dim"
    >
      <span className="grid h-16 w-16 place-items-center rounded-full bg-evergreen text-white shadow-raised">
        <CameraIcon className="h-7 w-7" />
      </span>
      <span>
        <span className="block text-base font-semibold text-ink">Snap a receipt</span>
        <span className="mt-1 block text-[0.82rem] text-ink-soft">
          Opens your camera — the AI drafts the ledger line, you approve it.
        </span>
      </span>
    </button>
  );
}

function CameraIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M4 8h2.5L9 5h6l2.5 3H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
