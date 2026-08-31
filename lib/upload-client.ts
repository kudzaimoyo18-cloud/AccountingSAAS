"use client";

import { createDocumentUploadUrl } from "@/lib/actions";

// Browser-side half of the direct-to-storage upload.
//
// Under Supabase the browser held an anon key and wrote to the bucket itself,
// with storage RLS deciding whether the write was allowed. R2 has no such
// policy layer and the app must never ship bucket credentials to the browser,
// so the flow is now: ask the server for a short-lived presigned PUT (the
// server picks the key from the session's company), then PUT the bytes straight
// to R2. The file still never passes through a serverless function, so Vercel's
// ~4.5MB body cap remains a non-issue.

export type UploadResult = { key: string } | { error: string };

export async function uploadToStorage(
  file: File,
  folder: "documents" | "captures" | "statements" = "documents",
): Promise<UploadResult> {
  const contentType = file.type || "application/octet-stream";

  const signed = await createDocumentUploadUrl(file.name, contentType, folder);
  if ("error" in signed) return { error: signed.error };

  let res: Response;
  try {
    res = await fetch(signed.url, {
      method: "PUT",
      // Must match the Content-Type the URL was signed with, or R2 rejects the
      // signature.
      headers: { "Content-Type": contentType },
      body: file,
    });
  } catch (err) {
    console.error("[upload] network:", err);
    return { error: "Upload failed — check your connection and try again." };
  }

  if (!res.ok) {
    console.error("[upload] r2:", res.status, await res.text().catch(() => ""));
    return { error: "Upload failed — please try again." };
  }

  return { key: signed.key };
}
