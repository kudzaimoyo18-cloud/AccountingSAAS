"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { captureReceipt } from "@/lib/books/capture-actions";
import { uploadToStorage } from "@/lib/upload-client";

// Camera-first capture: the button opens the phone's own camera (rear lens) via
// the `capture` attribute. The photo is PUT straight from the browser to R2
// using a presigned URL scoped to the caller's own company prefix, and only the
// storage KEY is submitted to the server action — the action
// request stays a few hundred bytes, so Vercel's ~4.5MB function body cap can
// never 413 a large photo again. On desktop the same control falls back to a
// normal file picker.

const MAX_BYTES = 15 * 1024 * 1024;

export function CaptureUpload() {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(file: File) {
    setError(null);
    if (file.size === 0) return;
    if (file.size > MAX_BYTES) {
      setError("Photo too large (max 15MB) — try again without RAW mode.");
      return;
    }

    setUploading(true);
    const mediaType = file.type || "application/octet-stream";
    const ext =
      mediaType === "image/png" ? "png" : mediaType === "application/pdf" ? "pdf" : "jpg";

    const result = await uploadToStorage(file, "captures");

    if ("error" in result) {
      setError(result.error);
      setUploading(false);
      return;
    }

    if (pathRef.current) pathRef.current.value = result.key;
    if (typeRef.current) typeRef.current.value = mediaType;
    if (nameRef.current) nameRef.current.value = file.name || `capture.${ext}`;
    // Hand over to the server action; `uploading` stays true so the busy panel
    // holds until the action's own pending state takes over (no setState while
    // the action is pending — that resets useFormStatus on Next 15.5).
    formRef.current?.requestSubmit();
  }

  return (
    <div>
      <form ref={formRef} action={captureReceipt}>
        <input type="hidden" name="path" ref={pathRef} />
        <input type="hidden" name="media_type" ref={typeRef} />
        <input type="hidden" name="original_name" ref={nameRef} />
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void handlePick(file);
          }}
        />
        <CaptureButton uploading={uploading} onPick={() => inputRef.current?.click()} />
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function CaptureButton({ uploading, onPick }: { uploading: boolean; onPick: () => void }) {
  const { pending } = useFormStatus();
  const busy = uploading || pending;

  if (busy) {
    return (
      <div className="panel flex flex-col items-center gap-4 px-6 py-12 text-center">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 animate-ping rounded-full bg-evergreen/20" />
          <div className="relative grid h-14 w-14 place-items-center rounded-full bg-evergreen-soft">
            <CameraIcon className="h-6 w-6 text-evergreen" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">
            {pending ? "Reading your receipt…" : "Uploading your photo…"}
          </p>
          <p className="mt-1 text-[0.82rem] text-ink-soft">
            {pending
              ? "Drafting the ledger line. This takes a few seconds."
              : "Sending it securely to your documents."}
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
      <span className="grid h-16 w-16 place-items-center rounded-full bg-evergreen text-sidebar shadow-raised">
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
