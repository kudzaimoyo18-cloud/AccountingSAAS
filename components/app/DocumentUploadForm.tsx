"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { recordDocument } from "@/lib/actions";

// Documents upload, direct-to-storage: the browser writes the file into the
// company's private storage folder (storage RLS enforces the prefix), then the
// server action only records the path — keeps the action request tiny so
// Vercel's ~4.5MB function body cap can't 413 a large PDF or photo.

const MAX_BYTES = 15 * 1024 * 1024;

const KINDS = [
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "other", label: "Other" },
];

export function DocumentUploadForm({
  companyId,
  serverError,
  serverOk,
}: {
  companyId: string;
  serverError?: string;
  serverOk?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pathRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // First phase (no storage path yet): intercept, upload from the browser,
    // then re-submit so the server action only sees the path.
    if (pathRef.current?.value) return; // second phase — let the action run
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!file || file.size === 0) {
      setError("Choose a file first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File too large (max 15MB).");
      return;
    }

    setUploading(true);
    const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 140);
    const path = `${companyId}/${Date.now()}-${safeName}`;

    const supabase = createClient();
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });

    if (upErr) {
      console.error("[documents] upload:", upErr.message);
      setError("Upload failed — check your connection and try again.");
      setUploading(false);
      return;
    }

    if (pathRef.current) pathRef.current.value = path;
    if (nameRef.current) nameRef.current.value = file.name.slice(0, 200);
    // `uploading` stays true; the action's pending state takes over from here
    // (no setState while pending — that resets useFormStatus on Next 15.5).
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={recordDocument} onSubmit={handleSubmit} className="card mt-5">
      <input type="hidden" name="path" ref={pathRef} />
      <input type="hidden" name="original_name" ref={nameRef} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          ref={fileRef}
          type="file"
          required
          className="field file:mr-3 file:rounded-lg file:border-0 file:bg-paper-dim file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
          aria-label="Choose file"
          onChange={() => {
            // New pick invalidates a previously uploaded path.
            if (pathRef.current) pathRef.current.value = "";
            setError(null);
          }}
        />
        <select name="kind" className="field sm:w-44" defaultValue="invoice" aria-label="Document type">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <UploadButton uploading={uploading} />
      </div>
      {(error || serverError) && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error ?? serverError}
        </p>
      )}
      {serverOk && !error && (
        <p className="mt-3 text-sm text-evergreen">Uploaded. We&apos;ll process it shortly.</p>
      )}
      <p className="mt-3 text-xs text-ink-soft">PDF, images, or spreadsheets. Max 15MB.</p>
    </form>
  );
}

function UploadButton({ uploading }: { uploading: boolean }) {
  const { pending } = useFormStatus();
  const busy = uploading || pending;
  return (
    <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
      {busy ? (pending ? "Filing…" : "Uploading…") : "Upload"}
    </button>
  );
}
