"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { captureReceipt } from "@/lib/books/capture-actions";

// Cash Now mobile Scan capture (design: MOBILE › Mobile SCAN). A camera
// viewfinder frame that opens the phone's real camera on tap, uploads the photo
// straight to Supabase Storage (the direct-to-storage path — no 413), and hands
// the storage path to captureReceipt. Same reliable upload as CaptureUpload,
// dressed as the design's viewfinder.

const MAX_BYTES = 15 * 1024 * 1024;

export function MobileScanCapture({ companyId }: { companyId: string }) {
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
      setError("Photo too large (max 15MB).");
      return;
    }
    setUploading(true);
    const mediaType = file.type || "application/octet-stream";
    const ext = mediaType === "image/png" ? "png" : mediaType === "application/pdf" ? "pdf" : "jpg";
    const path = `${companyId}/${Date.now()}-capture.${ext}`;

    const supabase = createClient();
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: mediaType });
    if (upErr) {
      console.error("[scan] upload:", upErr.message);
      setError("Upload failed — check your connection and try again.");
      setUploading(false);
      return;
    }
    if (pathRef.current) pathRef.current.value = path;
    if (typeRef.current) typeRef.current.value = mediaType;
    if (nameRef.current) nameRef.current.value = file.name || `capture.${ext}`;
    formRef.current?.requestSubmit();
  }

  return (
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
      <ViewfinderAndButton uploading={uploading} onPick={() => inputRef.current?.click()} />
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function ViewfinderAndButton({ uploading, onPick }: { uploading: boolean; onPick: () => void }) {
  const { pending } = useFormStatus();
  const busy = uploading || pending;

  return (
    <>
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        aria-label="Open camera to snap a receipt"
        className="relative mb-5 block aspect-[3/4] w-full overflow-hidden rounded-[26px] bg-[#05100C]"
      >
        {/* framing brackets */}
        <span className="pointer-events-none absolute inset-[26px] rounded-[18px] border-2 border-evergreen/70" aria-hidden />
        <span className="pointer-events-none absolute left-[26px] top-[26px] h-[34px] w-[34px] rounded-tl-[8px] border-l-[3px] border-t-[3px] border-evergreen" aria-hidden />
        <span className="pointer-events-none absolute bottom-[26px] right-[26px] h-[34px] w-[34px] rounded-br-[8px] border-b-[3px] border-r-[3px] border-evergreen" aria-hidden />
        <span className="absolute inset-0 grid place-items-center text-[13px] font-semibold text-[#9fb3a9]">
          {busy ? (pending ? "Reading your receipt…" : "Uploading…") : "Align receipt within frame"}
        </span>
      </button>
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="mb-[22px] w-full rounded-[18px] bg-evergreen py-[15px] text-[15px] font-extrabold text-sidebar disabled:opacity-60"
      >
        {busy ? "Working…" : "Capture"}
      </button>
    </>
  );
}
